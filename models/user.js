const mongoose = require("mongoose");
const passportLocalMongosse=require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    age: {
        type: Number,
        required: true
    },
    events: [{
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },
        ticketsBooked: {
            type: Number,
            default: 0
        }
    }]
});


userSchema.plugin(passportLocalMongosse);


const User=mongoose.model("User",userSchema);

module.exports=User;