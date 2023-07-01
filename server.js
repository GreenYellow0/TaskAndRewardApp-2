const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const Schema = mongoose.Schema;
const PDFDocument = require('pdfkit');
const path = require('path');


 
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));



  // Set up the models and schemas
const questionSchema = new mongoose.Schema({
  question: String,
  type: String
});

const Question = mongoose.model('Question', questionSchema);



  const orgasmSchema = new mongoose.Schema({
    type: String,
    date: { type: Date, default: Date.now },
    time: { type: Date, default: () => Date.now() }
  });


  const cageAlarmSchema = new mongoose.Schema({
    type: String,
    date: { type: Date, default: Date.now },
    time: Date
  });


  const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    email: { type: String, unique: true },
    notes: [String],
    orgasms: [orgasmSchema],
    cageAlarms: [cageAlarmSchema],

  });
  
  userSchema.plugin(passportLocalMongoose);
  const User = mongoose.model('User', userSchema);
  

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.set('view engine', 'ejs');

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

// Login route
app.get('/login', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard'); // Redirect to the dashboard if the user is already logged in
  } else {
    res.render('index'); // Render the index template (signup and login form)
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true
}));

// Sign up route
app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  User.register(new User({ username, email }), password, (err, user) => {
    if (err) {
      console.error(err);
      res.redirect('/');
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/dashboard');
      });
    }
  });
});

// Logout route
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return next(err);
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      return res.redirect('/'); // Redirect to the home page or any other page after logout
    });
  });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  // Assuming you have user information available in req.user
  const user = req.user;
  res.render('dashboard', { user });
});

// Profile route
app.get('/profile/:id', (req, res) => {
  const userId = req.params.id;

  User.findById(userId)
    .then(user => {
      if (!user) {
        console.error('User not found');
        res.redirect('/dashboard');
      } else {
        res.render('profile', { user });
      }
    })
    .catch(err => {
      console.error(err);
      res.redirect('/dashboard');
    });
});

app.post('/profile/:id', (req, res) => {
  const userId = req.params.id;
  const { email, password, username } = req.body;

  User.findByIdAndUpdate(userId, { email, password, username })
    .then(() => {
      User.findById(userId) // Retrieve the updated user from the database
        .then(updatedUser => {
          if (!updatedUser) {
            console.error('User not found');
            res.redirect('/dashboard');
          } else {
            req.login(updatedUser, err => {
              if (err) {
                console.error('Error logging in:', err);
                return next(err);
              }
              res.redirect('/dashboard');
            });
          }
        })
        .catch(err => {
          console.error(err);
          res.redirect('/dashboard');
        });
    })
    .catch(err => {
      console.error(err);
      res.redirect('/dashboard');
    });
});


// Keyholder Portal route
app.get('/keyholder-lockee-portal', (req, res) => {
  res.render('keyholder-lockee-portal', { user: req.user });
});


// Save note route
app.post('/saveNote', (req, res) => {
  const userId = req.user._id;
  const { note } = req.body;

  User.findByIdAndUpdate(userId, { $push: { notes: note } })
    .then(() => {
      res.redirect('/notes');
    })
    .catch(err => {
      console.error(err);
      res.redirect('/notes');
    });
});

// Remove note route
app.post('/removeNote', (req, res) => {
  const userId = req.user._id;
  const noteIndex = req.body.noteIndex;

  User.findById(userId)
    .then(user => {
      if (!user) {
        console.error('User not found');
        res.redirect('/notes');
      } else {
        user.notes.splice(noteIndex, 1);
        user.save()
          .then(() => {
            res.redirect('/notes');
          })
          .catch(err => {
            console.error(err);
            res.redirect('/notes');
          });
      }
    })
    .catch(err => {
      console.error(err);
      res.redirect('/keyholder-portal');
    });
});

app.post('/saveOrgasm', (req, res) => {
  const userId = req.user._id;
  const { type } = req.body;
  const date = new Date(); // Get the current date and time

  User.findByIdAndUpdate(
    userId,
    { $addToSet: { orgasms: { type, date, time: date.toISOString() } } },
    { new: true }
  )
    .then((updatedUser) => {
      res.redirect('/orgasm-tracker');
    })
    .catch((err) => {
      console.error(err);
      res.redirect('/orgasm-tracker');
    });
});



// Orgasm Tracker route
app.get('/orgasm-tracker', (req, res) => {
  // Assuming you have user information available in req.user
  const user = req.user;
  const orgasms = user.orgasms; // Retrieve the orgasm data for the user

  res.render('orgasm-tracker', { user, orgasms });
});

app.get('/getChartData', (req, res) => {
  const userId = req.user._id;
  const timeRange = req.query.timeRange;

  User.findById(userId)
    .then((user) => {
      let orgasms = user.orgasms;

      // Get the start and end date for the selected time range
      let startDate, endDate;
      if (timeRange === 'week') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Set the start date to the beginning of the current day
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Set the start date to Monday of the current week
        endDate = new Date();
      } else if (timeRange === 'month') {
        startDate = new Date();
        startDate.setDate(1); // Set the start date to the beginning of the current month
        endDate = new Date();
      } else if (timeRange === 'year') {
        startDate = new Date();
        startDate.setMonth(0, 1); // Set the start date to January 1 of the current year
        endDate = new Date();
      }

      // Filter the orgasms based on the selected time range
      const filteredOrgasms = orgasms.filter((orgasm) => {
        const orgasmDate = new Date(orgasm.date);
        return orgasmDate >= startDate && orgasmDate <= endDate;
      });

      // Group the orgasms by date and count the number of orgasms for each date
      const chartData = {};
      filteredOrgasms.forEach((orgasm) => {
        const dateStr = orgasm.date.toISOString().split('T')[0];
        if (chartData[dateStr]) {
          chartData[dateStr]++;
        } else {
          chartData[dateStr] = 1;
        }
      });

      // Prepare the data in the required format for the chart
      const labels = Object.keys(chartData);
      const orgasmCounts = Object.values(chartData);

      res.json({ labels, orgasmCounts });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve chart data' });
    });
});







// Handle GET request for '/orgasm-log'
app.get('/orgasm-log', (req, res) => {
  const userId = req.user._id;

  // Retrieve the logged-in user's orgasms from the database
  User.findById(userId)
    .then((user) => {
      const orgasms = user.orgasms;
      res.render('orgasm-log', { user, orgasms }); // Pass the 'user' variable to the view
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve orgasms' });
    });
});

app.get('/help-doc', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('help-doc', { user });
});


app.get('/spinningwheel', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('spinningwheel', { user });
});


app.get('/games', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('games', { user });
});

app.get('/locktober-countdown', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('locktober-countdown', { user });
});

app.get('/notes', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('notes', { user });
});


app.get('/questions-page', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('questions-page', { user });
});

app.get('/basic-questions', (req, res) => {
  const user = req.user; // Assuming you have stored the user object in the req.user property
  res.render('basic-questions', { user });
});

app.get('/basic-questions', (req, res) => {
  res.render('basic-questions', { user: req.user });
});


app.post('/saveCageAlarm', (req, res) => {
  const userId = req.user._id;
  const date = new Date();

  User.findById(userId)
    .then((user) => {
      user.cageAlarms.push({ date: date, time: date.toISOString() });

      user.save()
        .then((updatedUser) => {
          res.json({ success: true });
        })
        .catch((saveError) => {
          console.error('Error saving cage alarm:', saveError);
          res.status(500).json({ success: false, error: 'Failed to save the cage alarm' });
        });
    })
    .catch((findError) => {
      console.error('Error finding user:', findError);
      res.status(500).json({ success: false, error: 'Failed to find the user' });
    });
});






app.get('/cage-alarm-tracker', (req, res) => {
  const userId = req.user._id;

  User.findById(userId)
    .then((user) => {
      const cageAlarms = user.cageAlarms;
      res.render('cage-alarm-tracker', { user, cageAlarms });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve cage alarms' });
    });
});





app.get('/getChartData', (req, res) => {
  const userId = req.user._id;
  const timeRange = req.query.timeRange;

  User.findById(userId)
    .then((user) => {
      const cageAlarms = user.cageAlarms;

      // Get the start and end date for the selected time range
      let startDate, endDate;
      if (timeRange === 'week') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        endDate = new Date();
      } else if (timeRange === 'month') {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        endDate = new Date();
      } else if (timeRange === 'year') {
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        endDate = new Date();
      }

      // Filter the cage alarms based on the selected time range and sort them by date
      const filteredAlarms = cageAlarms
        .filter((alarm) => {
          const alarmDate = new Date(alarm.date);
          return alarmDate >= startDate && alarmDate <= endDate;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Group the filtered alarms by date and count the number of alarms for each date
      const chartData = {};
      filteredAlarms.forEach((alarm) => {
        const dateStr = alarm.date.toISOString().split('T')[0];
        chartData[dateStr] = (chartData[dateStr] || 0) + 1;
      });

      // Create an array of objects with date and count properties for chart data
      const data = Object.keys(chartData).map(date => ({ date, count: chartData[date] }));

      res.json({ success: true, data });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to retrieve chart data' });
    });
});







app.get('/cage-alarm-log', (req, res) => {
  const userId = req.user._id;

  User.findById(userId)
    .then((user) => {
      const cageAlarms = user.cageAlarms;
      res.render('cage-alarm-log', { user, cageAlarms });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve cage alarms' });
    });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Define route for generating the PDF file
app.post('/generate-pdf', (req, res) => {
  const doc = new PDFDocument();

  // Set the response headers for PDF file
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="basic-questions-${Date.now()}.pdf"`);

  // Pipe the PDF document to the response
  doc.pipe(res);

// Load and embed the image
const imagePath = path.join(__dirname, 'public', 'images', 'LOGO-removebg-preview.png');
doc.image(imagePath, doc.page.width - 100, 30, { width: 75 });


// Write the questions and answers to the PDF document
doc.fontSize(16).text('Basic Questions:', { underline: true });

// Format the user-inputted answers
doc.font('Helvetica').fontSize(12).text('Username:', { continued: true }).font('Helvetica-Bold').text(` ${req.body.name}`);
doc.font('Helvetica').fontSize(12).text('Gender:', { continued: true }).font('Helvetica-Bold').text(` ${req.body.gender}`);
doc.font('Helvetica').fontSize(12).text('Country:', { continued: true }).font('Helvetica-Bold').text(` ${req.body.country}`);
doc.font('Helvetica').fontSize(12).text('Longest In Chastity:', { continued: true }).font('Helvetica-Bold').text(` ${req.body.chastityduration}`);
doc.font('Helvetica').fontSize(12).text('Type of chastity device you own:', { continued: true }).font('Helvetica-Bold').text(` ${req.body.chastitydeviceown}`);




// Reset the font to the default
doc.font('Helvetica').fontSize(12);


// Add the "Generated on the ChastityLogHub website" line with underline
doc.moveDown().fontSize(10).text('Generated on the ChastityLogHub website');
const underlineY = doc.y + 3; // Adjust the value to position the underline appropriately
doc.lineWidth(1).moveTo(doc.x, underlineY).lineTo(doc.x + doc.widthOfString('Generated on the ChastityLogHub website'), underlineY).stroke();

// Finalize the PDF document
doc.end();

});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
