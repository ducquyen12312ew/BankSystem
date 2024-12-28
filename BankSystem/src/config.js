const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb://0.0.0.0:27017/Login-tut");

connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
})

// Schema cho thông tin đăng nhập
const Loginschema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true,
        default: 5930293 // Set default amount
    },
    saving: {
        type: Number,
        required: true,
        default: 270206 // Set default amount
    },
    remainingDebt: {
        type: Number,
        default: 0 // Số tiền còn lại cần thanh toán
    },
    monthlyDue: {
        type: Number,
        default: 0 // Số tiền cần trả mỗi kỳ
    },
    term: {
        type: Number,
        default: 0 // Thời hạn còn lại (tháng)
    }
});

// Middleware để tạo số tài khoản ngẫu nhiên trước khi lưu
Loginschema.pre('save', function(next) {
    if (!this.accountNumber) {
        this.accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    }
    next();
});

// Model cho thông tin đăng nhập
const UserCollection = mongoose.model("users", Loginschema);

// Schema cho thông tin giao dịch
const TransactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    amount: { type: Number, required: true },
    transactionDate: { type: Date, default: Date.now },
    transactionType: { type: String, enum: ['deposit', 'withdraw','purchase'], required: true },
    description: { type: String, required: false }
});

const TransactionCollection = mongoose.model("transactions", TransactionSchema);

module.exports = { UserCollection, TransactionCollection};
