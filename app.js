if(process.env.NODE_ENV!="production"){
  require('dotenv').config()
}


const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const ejsMate = require("ejs-mate");
const mongoose = require("mongoose");
const Event = require("./models/Event");
const Artist = require("./models/Artist");
const {getUpcomingEventsForCurrentYear,getEventsForToday}= require("./upcomingEvents");
const Category = require("./models/Category");
const Razorpay = require("razorpay");
const Seat = require("./models/Seat");
const session = require("express-session");
const MongoStore=require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const flash = require("connect-flash");
const { isLoggedIn, saveRedirectUrl } = require("./middleWare");
const {bookSeat,sendTicketMail} = require("./helper");
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const fs=require("fs");




const razorpay = new Razorpay({
  key_id:process.env.RAZORPAY_ID,
  key_secret:process.env.RAZORPAY_SECRET
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(express.static(path.join(__dirname, "/public")));
app.engine('ejs', ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const store=MongoStore.create({
  mongoUrl:process.env.ATLASDB_URL,
  crypto:{
    secret:process.env.SECRET
  },
  touchAfter:24*3600
});

store.on("error",()=>{
     
      console.log("ERROR IN MONGO SESSION STORE",err);
});


const sessionOptions = {
  store,
  secret:process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true
  }
};



app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

const dburl = process.env.ATLASDB_URL;

mongoose.connect(dburl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('Connection error', err);
});




// Call the async function

// Real-time event handling
io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle custom events here
  socket.on('getUpdates', async () => {
    const events = await Event.find({});
    socket.emit('updateEvents', events);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

app.get("/", async (req, res) => {
  const category = await Category.find({});
  const events = await Event.find({});
  const ue = getUpcomingEventsForCurrentYear(events);

  res.render("home/home.ejs", { ue, category });
});

app.get("/event/:id", async (req, res) => {
  let { id } = req.params;
  let result = await Event.findById(id).populate("artists");
  res.render("home/event.ejs", { result });
});

app.get("/event/:id/book", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let result = await Event.findById(id).populate("seats");
  res.render("home/book.ejs", { result });
});

app.post("/event/:id/book/getTicket", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let ticketCount = parseInt(req.body.tickets, 10);
  let ticketType = req.body.ticketType;
  let eventData = await Event.findById(id).populate("seats");
  let price = parseInt(eventData.seats.filter(seat => seat.type == ticketType)[0].price, 10);

  if (isNaN(ticketCount)) {
    return res.status(400).json({ error: "Invalid number of tickets" });
  }

  let options = {
    amount: price * ticketCount * 100,
    currency: "INR"
  };

  razorpay.orders.create(options, (err, order) => {
    console.log(order);
    res.json(order);
  });
});

app.get("/category/:c_id", async (req, res) => {
  let { c_id } = req.params;
  let result = await Category.findById(c_id).populate("events");
  res.render("home/category.ejs", { result });
});

app.get("/signUp", (req, res) => {
  res.render("forms/signUp.ejs");
});

app.post("/signUp", async (req, res) => {
  let result = req.body;
  let newUser = new User(result.info);
  let password = result.password;
  let ans = await User.register(newUser, password);

  req.login(newUser, (err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "Welcome to Tune Tickets");
    res.redirect("/");
  });
});

app.get("/login", (req, res) => {
  res.render("forms/login.ejs");
});

app.post("/login", saveRedirectUrl, passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: true
}), async (req, res) => {
  req.flash("success", "Welcome Back to Tune Tickets");
  if (!res.locals.redirectUrl) {
    res.redirect('/');
  } else {
    res.redirect(res.locals.redirectUrl);
  }
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are Logged Out");
    res.redirect("/");
  });
});

app.post("/dashboard/:r_id/:t_id/:t_count", isLoggedIn, async (req, res) => {
  let { r_id, t_id, t_count } = req.params;
  t_count = parseInt(t_count, 10);
  let myEvent=await Event.findById(r_id);

  try {
    const result = await Event.findById(r_id).populate("seats");
    const findSeat = result.seats.filter(seat => seat.type === t_id);

    if (findSeat.length === 0) {
      req.flash("error", "Seat type not found.");
      return res.redirect("/");
    }

    const paymentId = req.body.razorpay_payment_id;
    const seatId = findSeat[0]._id;
    const quantity = t_count;

    const paymentDocument = await razorpay.payments.fetch(paymentId);

    if (paymentDocument.status === "captured") {
      try {
        await bookSeat(seatId, quantity);

        let user = await User.findOne({ _id: req.user._id });

        if (user) {
          let eventIndex = user.events.findIndex(event => event.event.toString() === r_id);

          if (eventIndex === -1) {
            let newEvent = { event: r_id, ticketsBooked: t_count };
            user.events.push(newEvent);
          } else {
            user.events[eventIndex].ticketsBooked += t_count;
          }


          // -----------------


          io.emit('seatBooked', {
            eventId: r_id,
            seatId: seatId,
            quantity: quantity
          });


          // -----------------

          await user.save();

          // ------------------------
          const qrData="#";
          let ticketName=uuidv4();
          const ticketsDir = path.join(__dirname, 'tickets');
          if (!fs.existsSync(ticketsDir)) {
            fs.mkdirSync(ticketsDir);
}

         const qrImagePath = path.join(ticketsDir, `${ticketName}.png`);



          await sendTicketMail(qrImagePath,qrData,user._id,myEvent._id,ticketName);


          // ------------------------

          req.flash("success", "Booking successful! Check Your Registered Email-id for Ticket");
          res.redirect("/dashboard");
        } else {
          req.flash("error", "User not found.");
          res.redirect("/");
        }
      } catch (error) {
        console.error("Booking failed:", error);
        req.flash("error", "Booking Failed! Please try again.");
        res.redirect("/");
      }
    } else {
      req.flash("error", "Payment failed! Please try again.");
      res.redirect("/");
    }
  } catch (error) {
    console.error("Error handling payment and booking:", error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/");
  }
});

app.get("/dashboard", isLoggedIn, async (req, res) => {
  let id = req.user._id;
  const user = await User.findById(id)
    .populate({
      path: 'events.event',
      populate: [
        {
          path: 'artists'
        },
        {
          path: 'seats'
        }
      ]
    });

  res.render("home/dashboard.ejs", { events: user.events });
});


app.get("/live", isLoggedIn, async (req, res) => {

    let id = req.user._id;
    const user = await User.findById(id)
      .populate({
        path: 'events.event',
        populate: [
          { path: 'artists' },
          { path: 'seats' }
        ]
      });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const events = user.events;
    const tevents = getEventsForToday(events);

    res.render("home/live.ejs", { tevents });
 
});

app.get("/live/:e_id",isLoggedIn,async(req,res)=>{

  let {e_id}=req.params;
  let event=await Event.findById(e_id);
  res.render("home/liveEvent.ejs",{event});

})


app.use((req, res) => {
  res.send("Page Not Found");
});

server.listen(8080, () => {
  console.log("app is listening!");
});
