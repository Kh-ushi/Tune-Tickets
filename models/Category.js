const mongoose=require("mongoose");


const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    imageUrl:{type:String,require:true},
    events: [{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Event"
    }]
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;