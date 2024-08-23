const mongoose = require("mongoose");


const seatSchema = new mongoose.Schema({
    type: { type: String, required: true },
    price: { type: Number, required: true },
    availability: { type: Number, required: true },
    sold: { type: Number, default: 0 },
}, { versionKey: '__v' });


const Seat = mongoose.model('Seat', seatSchema);

module.exports=Seat;




