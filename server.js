const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const flash = require('connect-flash');
require('dotenv').config();

 
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

  const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    email: { type: String, unique: true },
    tasks: [{ task: String, coins: Number }],
    rewards: [{ reward: String, cost: Number }]
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

// ...







// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
