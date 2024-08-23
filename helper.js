const { default: mongoose } = require("mongoose");
const Seat = require("./models/Seat");
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const Event=require("./models/Event");
const User=require("./models/user");

async function bookSeat(seatId, quantity) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const seat = await Seat.findById(seatId).session(session);

        if (!seat) {
            throw new Error("Seat Not Found");
        }
        if (seat.availability < quantity) {
            throw new Error("Not enough seats available");
        }

        const updateResult = await Seat.updateOne(
            { _id: seatId, availability: { $gte: quantity } },
            {
                $inc: { sold: quantity, availability: -quantity }
            },
            { session }
        );

        if (updateResult.nModified === 0) {
            throw new Error("Update failed: seat was modified by another transaction or insufficient availability.");
        }

        await session.commitTransaction();
        return { success: true, message: "Booking successful" };
    } catch (error) {
        await session.abortTransaction();
        throw new Error("Booking failed. " + error.message);
    } finally {
        session.endSession();
    }
}





const sendTicketMail = async (qrImagePath, qrData, user_id, eve_id,ticketName) => {
    try {
        // Fetch user and event data
        const user = await User.findById(user_id);
        const myEvent = await Event.findById(eve_id);

        // Generate QR code and save it to a file
        await QRCode.toFile(qrImagePath, qrData, {
            color: {
                dark: '#000000', // Black color
                light: '#ffffff' // White background
            }
        });
        console.log('QR code generated and saved');

        // Create a transporter object using Gmail's SMTP transport
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587, // or 465 for SSL
            secure: false, // true for 465, false for 587
            auth: {
                user: 'manangupta0717@gmail.com', // Replace with your email
                pass: 'mvdq ljtp brlr cnsp' // Replace with your app-specific password
            }
        });

        const isoDateString =myEvent.date;
        const date = new Date(isoDateString);

        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1; // Months are zero-indexed
        const day = date.getUTCDate();
        const formattedDate = `${day}-${month}-${year}`;


       
        const formatTime = (date) => {
            let hours = date.getUTCHours();
            let minutes = date.getUTCMinutes();
          
            // Determine AM/PM
            const period = hours >= 12 ? 'pm' : 'am';
          
            // Convert hours from 24-hour to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            
            // Format minutes to always have two digits
            minutes = minutes < 10 ? `0${minutes}` : minutes;
          
            return `${hours}:${minutes}${period}`;
          };
          
          const formattedTime = formatTime(date);

         const venue=myEvent.venue;
          const formatAddress = (venue) => {
            return `${venue.name}\n${venue.address}\n${venue.city}, ${venue.state} ${venue.zipCode}\n${venue.country}`;
        };
        
        const formattedAddress = formatAddress(venue);


        // Set up email data with inline CSS styling
        const mailOptions = {
            from: '"Tune Tickets" manangupta0717@gmail.com', // Replace with your email
            to: user.email,
            subject: myEvent.name,
            html: `
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { padding: 20px; }
                        .content h2 { font-size: 20px; color: #333; }
                        .content p { font-size: 16px; line-height: 1.5; }
                        .ticket-info { background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
                        .ticket-info ul { list-style-type: none; padding: 0; }
                        .ticket-info li { margin-bottom: 10px; }
                        .footer { text-align: center; padding: 10px; background-color: #f4f4f4; border-top: 1px solid #ddd; }
                        .qr-code { margin-top: 20px; }
                        .qr-code img { max-width: 150px; height: auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Your Ticket</h1>
                        </div>
                        <div class="content">
                            <h2>Hello,</h2>
                            <p>Here are your ticket details:</p>
                            <div class="ticket-info">
                                <ul>
                                    <li><strong>Event:</strong> ${myEvent.name}</li>
                                    <li><strong>Date:</strong>  ${formattedDate}</li>
                                    <li><strong>Time:</strong>  ${formattedTime}</li>
                                    <li><strong>Venue:</strong> ${formattedAddress}</li>
                                    <li><strong>Ticket Id:</strong> ${user_id}</li>
                                </ul>
                            </div>
                            <p>Enjoy the event!</p>
                            <div class="qr-code">
                                <p>Make it Scan Before Entering</p>
                                <img src="cid:ticket-qr" alt="QR Code">
                            </div>
                        </div>
                        <div class="footer">
                            <p>Best regards,<br>Tune Tickets Team</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            attachments: [
                {
                    filename: `${ticketName}.png`,
                    path: qrImagePath,
                    cid: 'ticket-qr' // Content ID for embedding in HTML
                }
            ]
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        console.log('Ticket sent successfully');
    } catch (err) {
        console.error('Error sending ticket email:', err);
    }
};


module.exports = {bookSeat,sendTicketMail};




















