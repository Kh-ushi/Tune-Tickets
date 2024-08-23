const mongoose=require("mongoose");


const artistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    genre: { type: String },
    bio: { type: String },
    imageUrl: { type: String }
});

const Artist=mongoose.model('Artist',artistSchema);

module.exports=Artist;
