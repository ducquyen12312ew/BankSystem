const express = require("express");
const path = require("path");
const { UserCollection, TransactionCollection } = require('./config');
const collection = UserCollection; // Giữ nguyên tên collection
const mongoose = require('mongoose');

const bcrypt = require('bcrypt');
const generateRandomAccountNumber = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};
const app = express();
const session = require('express-session');

app.use(session({
    secret: 'your-secret-key', // Thay bằng khóa bí mật của bạn
    resave: false, // Không lưu lại session nếu không thay đổi
    saveUninitialized: true, // Lưu session mới dù chưa có dữ liệu
    cookie: { secure: false } // Nếu sử dụng HTTPS, hãy đặt thành true
}));

app.use(express.json());

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
//use EJS as the view engine
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.username,
        phone: req.body.phone,
        password: req.body.password
    };

    const existingUser = await collection.findOne({ name: data.name });

    if (existingUser) {
        res.send('User already exists. Please choose a different username.');
    } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;
        data.amount = 5930293;
        data.saving = 5930293;
        const userdata = await collection.insertMany(data);
        console.log(userdata);
        res.render('home', { data });
    }
});

app.post("/home", async (req, res) => {
    try {
        const check = await collection.findOne({ name: req.body.username });
        if (!check) {
            res.send("Tên người dùng không tồn tại");
        } else {
            const validPassword = await bcrypt.compare(req.body.password, check.password);
            if (validPassword) {
                req.session.name = req.body.username; // Lưu `name` vào session
                const accountNumber = generateRandomAccountNumber();
                await collection.updateOne({ name: req.body.username }, { $set: { accountNumber: accountNumber } });
                const updatedUser = await collection.findOne({ name: req.body.username });
                res.render('home', { data: updatedUser }); // Truyền dữ liệu user đã cập nhật tới home
            } else {
                res.send('Tên người dùng hoặc mật khẩu không đúng');
            }
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Lỗi máy chủ nội bộ');
    }
});


app.post('/update-amount', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để nạp tiền.' });
        }

        const user = await UserCollection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        // Cập nhật số dư
        user.amount += amount;
        await user.save();

        // Lưu thông tin giao dịch vào TransactionCollection
        const transaction = new TransactionCollection({
            transactionId: new mongoose.Types.ObjectId().toString(),
            sender: name,
            receiver: name,
            amount,
            transactionType: 'deposit'
        });
        await transaction.save();

        // Trả về kết quả
        res.json({ success: true, message: 'Nạp tiền thành công.', newAmount: user.amount });
    } catch (error) {
        console.error('Error updating amount:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

// Xử lý giao dịch rút tiền
app.post('/withdraw-amount', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để rút tiền.' });
        }

        const user = await UserCollection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        // Kiểm tra số dư
        if (user.amount < amount) {
            return res.status(400).json({ success: false, message: 'Số dư không đủ để thực hiện giao dịch.' });
        }

        // Trừ số tiền
        user.amount -= amount;
        await user.save();

        // Lưu thông tin giao dịch
        const transaction = new TransactionCollection({
            transactionId: new mongoose.Types.ObjectId().toString(),
            sender: name,
            receiver: name, // Người nhận cũng là người dùng (self)
            amount,
            transactionType: 'withdraw'
        });
        await transaction.save();

        res.json({ success: true, message: 'Rút tiền thành công.', newAmount: user.amount });
    } catch (error) {
        console.error('Error withdrawing amount:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

app.post('/update-saving', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (user.amount < amount) {
            return res.status(400).json({ success: false, message: 'Số dư không đủ.' });
        }

        user.amount -= amount;
        user.saving += amount;
        await user.save();

        res.json({ success: true, message: 'Cập nhật tiết kiệm thành công.', newSaving: user.saving, newAmount: user.amount });
    } catch (error) {
        console.error('Error updating saving:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});
app.post('/withdraw-saving', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (user.saving < amount) {
            return res.status(400).json({ success: false, message: 'Tiền tiết kiệm không đủ.' });
        }

        user.saving -= amount;
        user.amount += amount;
        await user.save();

        res.json({ success: true, message: 'Rút tiền thành công.', newSaving: user.saving, newAmount: user.amount });
    } catch (error) {
        console.error('Error withdrawing saving:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});
function getInterestRate(saving) {
    if (saving >= 100000000) return 0.03; // 3% lãi suất cho >= 100 triệu
    if (saving >= 10000000) return 0.04; // 4% lãi suất cho >= 10 triệu
    if (saving >= 1000000) return 0.05;  // 5% lãi suất cho >= 1 triệu
    return 0; // Không tính lãi nếu dưới 1 triệu
}

setInterval(async () => {
    try {
        const users = await collection.find();
        for (const user of users) {
            const interestRate = getInterestRate(user.saving);
            const interest = user.saving * (interestRate / 12 / 30);
            await collection.updateOne(
                { _id: user._id },
                { $inc: { saving: interest } } // Chỉ cập nhật trường saving
            );
        }
        console.log('Lãi suất đã được cập nhật.');
    } catch (error) {
        console.error('Error updating savings with interest:', error);
    }
}, 1800000);

//vaytragop
app.post('/create-loan', async (req, res) => {
    const { amount, term } = req.body;

    if (!amount || amount <= 0 || !term || term <= 0) {
        return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        const interestRate = 12; // Lãi suất năm là 12%
        const monthlyRate = (interestRate / 100) / 12;
        const monthlyPayment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));
        const totalPayment = monthlyPayment * term;

        user.remainingDebt = Math.round(totalPayment);
        user.monthlyDue = Math.round(monthlyPayment);
        user.term = term;

        await user.save();

        res.json({
            success: true,
            totalPayment: user.remainingDebt,
            monthlyPayment: user.monthlyDue
        });
    } catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

app.post('/pay-loan-installment', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (user.amount < amount) {
            return res.status(400).json({ success: false, message: 'Số dư không đủ để thanh toán.' });
        }

        // Trừ tiền gốc và cập nhật khoản vay
        user.amount -= amount;
        await user.save();

        res.json({ success: true, message: 'Thanh toán thành công!' });
    } catch (error) {
        console.error('Error processing installment payment:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
});

app.post('/pay-full-loan', async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (user.amount < amount) {
            return res.status(400).json({ success: false, message: 'Số dư không đủ để thanh toán toàn bộ khoản vay.' });
        }

        // Trừ số tiền trong tài khoản và xóa khoản vay
        user.amount -= amount;
        await user.save();

        res.json({ success: true, message: 'Thanh toán toàn bộ khoản vay thành công!' });
    } catch (error) {
        console.error('Error processing full loan payment:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});
app.post('/api/purchase', async (req, res) => {
    const { productId, price, productName } = req.body;

    try {
        const name = req.session.name;
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để mua hàng.' });
        }

        const user = await UserCollection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (user.amount < price) {
            return res.status(400).json({ success: false, message: 'Số dư không đủ để mua sản phẩm.' });
        }

        // Trừ tiền
        user.amount -= price;
        await user.save();

        // Tạo bản ghi giao dịch
        const transaction = new TransactionCollection({
            transactionId: new mongoose.Types.ObjectId().toString(),
            sender: name,
            receiver: 'Dịch vụ mua hàng',
            amount: price,
            transactionType: 'purchase',
            description: `Mua ${productName}` // Thêm mô tả
        });
        await transaction.save();

        res.json({ success: true, message: `Mua ${productName} thành công!` });
    } catch (error) {
        console.error('Error during purchase:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});



app.get('/loan-info', async (req, res) => {
    try {
        const name = req.session.name; // Lấy tên người dùng từ session
        if (!name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }

        const user = await collection.findOne({ name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        res.json({
            success: true,
            remainingDebt: user.remainingDebt,
            monthlyDue: user.monthlyDue,
            term: user.term
        });
    } catch (error) {
        console.error('Error fetching loan info:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

// Endpoint để gửi dữ liệu tiết kiệm cập nhật sang frontend
app.get('/saving-data', async (req, res) => {
    try {
        if (!req.session.name) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
        }

        const user = await collection.findOne({ name: req.session.name });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        res.json({ success: true, saving: user.saving });
    } catch (error) {
        console.error('Error fetching saving data:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
});

module.exports = app;
app.get('/naptien', (req, res) => {
    res.render('naptien');
});
app.get('/ruttien', (req, res) => {
    res.render('ruttien');
});

app.get('/home', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('home', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('/home');
    }
});
app.get('/saving', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('saving', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/card', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('card', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/vay', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('vay', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/vaytragop', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('vaytragop', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/vay', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('vay', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/vaythechap', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('vaythechap', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/profile', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('profile', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/shopping', (req, res) => {
    if (req.session.name) {
        collection.findOne({ name: req.session.name }).then(user => {
            res.render('shopping', { data: user });
        }).catch(error => {
            console.error('Error fetching user data:', error);
            res.status(500).send('Lỗi máy chủ nội bộ');
        });
    } else {
        res.redirect('saving');
    }
});
app.get('/thongbao', async (req, res) => {
    if (req.session.name) {
        const transactions = await TransactionCollection.find({ sender: req.session.name }).sort({ transactionDate: -1 });
        res.render('thongbao', { transactions });
    } else {
        res.redirect('/login');
    }
});

const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
});