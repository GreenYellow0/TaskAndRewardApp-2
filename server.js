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
require('dotenv').config();

 
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));



  const orgasmSchema = new mongoose.Schema({
    type: String,
    date: { type: Date, default: Date.now },
    time: { type: Date, default: () => Date.now() }
  });

  const cageAlarmSchema = new mongoose.Schema({
    activated: { type: Boolean, default: false },
    time: { type: Date, default: null }
  });
  
  const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    email: { type: String, unique: true },
    tasks: [{ task: String, coins: Number }],
    rewards: [{ reward: String, cost: Number }],
    notes: [String],
    orgasms: [orgasmSchema],
    cageAlarms: [cageAlarmSchema] // Changed field name to 'cageAlarms'
  });
  
  
  


userSchema.plugin(passportLocalMongoose); // Add passport-local-mongoose plugin

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


// Save task route
app.post('/saveTask', (req, res) => {
  const { task, coins } = req.body;
  const userId = req.user._id;

  // Create a new task object with task and coins
  const newTask = { task, coins };

  // Save the task to the database for the user
  User.findByIdAndUpdate(userId, { $push: { tasks: newTask } })
    .then(() => {
      res.redirect('/task-and-reward'); // Redirect to the task-and-reward page instead of the dashboard
    })
    .catch(err => {
      console.error(err);
      res.redirect('/task-and-reward'); // Redirect to the task-and-reward page instead of the dashboard
    });
});

// Save reward route
app.post('/saveReward', (req, res) => {
  const { reward, cost } = req.body;
  const userId = req.user._id;

  // Create a new reward object with reward and cost
  const newReward = { reward, cost };

  // Save the reward to the database for the user
  User.findByIdAndUpdate(userId, { $push: { rewards: newReward } })
    .then(() => {
      res.redirect('/task-and-reward'); // Redirect to the task-and-reward page instead of the dashboard
    })
    .catch(err => {
      console.error(err);
      res.redirect('/task-and-reward'); // Redirect to the task-and-reward page instead of the dashboard
    });
});

// ...

// Remove task route
app.post('/removeTask', (req, res) => {
  const userId = req.user._id;
  const taskId = req.body.taskId;

  User.findByIdAndUpdate(userId, { $pull: { tasks: { _id: taskId } } })
    .then(() => {
      res.json({ success: true, message: 'Task removed successfully.' });
    })
    .catch(err => {
      console.error(err);
      res.json({ success: false, message: 'An error occurred while removing the task.' });
    });
});

// Remove reward route
app.post('/removeReward', (req, res) => {
  const userId = req.user._id;
  const rewardId = req.body.rewardId;

  User.findByIdAndUpdate(userId, { $pull: { rewards: { _id: rewardId } } })
    .then(() => {
      res.json({ success: true, message: 'Reward removed successfully.' });
    })
    .catch(err => {
      console.error(err);
      res.json({ success: false, message: 'An error occurred while removing the reward.' });
    });
});



// ...

// Task and Reward route
app.get('/task-and-reward', (req, res) => {
  // Assuming you have user information available in req.user
  const user = req.user;
  res.render('task-and-reward', { user });
});

// Keyholder Portal route
app.get('/keyholder-portal', (req, res) => {
  res.render('keyholder-portal', { user: req.user });
});


// Save note route
app.post('/saveNote', (req, res) => {
  const userId = req.user._id;
  const { note } = req.body;

  User.findByIdAndUpdate(userId, { $push: { notes: note } })
    .then(() => {
      res.redirect('/keyholder-portal');
    })
    .catch(err => {
      console.error(err);
      res.redirect('/keyholder-portal');
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
        res.redirect('/keyholder-portal');
      } else {
        user.notes.splice(noteIndex, 1);
        user.save()
          .then(() => {
            res.redirect('/keyholder-portal');
          })
          .catch(err => {
            console.error(err);
            res.redirect('/keyholder-portal');
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

  // Write code to retrieve the data based on the time range
  // For example:
  User.findById(userId)
    .then((user) => {
      const orgasms = user.orgasms;

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







app.post('/saveCageAlarm', (req, res) => {
  const userId = req.user._id;
  const date = new Date(); // Get the current date and time

  User.findByIdAndUpdate(
    userId,
    { $push: { cageAlarms: { timestamp: date } } }, // Change 'time' to 'timestamp'
    { new: true }
  )
    .then((updatedUser) => {
      res.redirect('/cage-alarm-tracker');
    })
    .catch((err) => {
      console.error(err);
      res.redirect('/cage-alarm-tracker');
    });
});

app.get('/cage-alarm-log', (req, res) => {
  const userId = req.user._id;

  User.findById(userId)
  .select('cageAlarms') // Change 'cageAlarm' to 'cageAlarms'
  .then((user) => {
    const cageAlarms = user.cageAlarms; // Update 'cageAlarm' to 'cageAlarms'
    res.render('cage-alarm-log', { user: req.user, cageAlarms });
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('An error occurred');
  });

});

app.get('/getCageAlarmChartData', (req, res) => {
  const userId = req.user._id;
  const timeRange = req.query.timeRange;

  User.findById(userId)
    .then((user) => {
      const cageAlarms = user.cageAlarms; // Update 'cageAlarm' to 'cageAlarms'

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

      const filteredCageAlarms = cageAlarms.filter((alarm) => {
        const alarmDate = new Date(alarm.timestamp);
        return alarmDate >= startDate && alarmDate <= endDate;
      });

      const chartData = {};
      filteredCageAlarms.forEach((alarm) => {
        const dateStr = alarm.timestamp.toISOString().split('T')[0];
        if (chartData[dateStr]) {
          chartData[dateStr]++;
        } else {
          chartData[dateStr] = 1;
        }
      });

      const labels = Object.keys(chartData);
      const alarmCounts = Object.values(chartData);

      res.json({ labels, alarmCounts });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve chart data' });
    });
});


app.get('/cage-alarm-tracker', (req, res) => {
  User.findById(req.user._id)
    .select('cageAlarms')
    .then((user) => {
      res.render('cage-alarm-tracker', { user: req.user, cageAlarms: user.cageAlarms });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('An error occurred');
    });
});


// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
