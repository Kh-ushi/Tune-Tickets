const mongoose = require('mongoose');

const Schema = mongoose.Schema;


// Define a schema for tickets


// Define the main event schema
const eventSchema = new Schema({
    name: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    venue: {
        name: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true }
    },
    artists: [{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Artist"
    }],
    seats:[{type:mongoose.Schema.Types.ObjectId,
           ref:"Seat"
    }],
    description: { type: String },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    video:{type:String},
    category:{type:String ,required:true},
    livelink:{type:String,required:true}
});

// Create and export the Event model
const Event = mongoose.model('Event', eventSchema);

module.exports = Event;



