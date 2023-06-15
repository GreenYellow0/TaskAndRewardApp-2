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
    type: String,
    date: { type: Date, default: Date.now },
    time: Date
  });
  
  
  const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    email: { type: String, unique: true },
    tasks: [{ task: String, coins: Number }],
    rewards: [{ reward: String, cost: Number }],
    notes: [String],
    orgasms: [orgasmSchema],
    cageAlarms: [cageAlarmSchema],
    taskLists: [{ name: String, tasks: [{ task: String, coins: Number }] }],
    rewardLists: [{ name: String, rewards: [{ reward: String, cost: Number }] }],
    coins: Number
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

      // Filter the cage alarms based on the selected time range
      const filteredAlarms = cageAlarms.filter((alarm) => {
        const alarmDate = new Date(alarm.date);
        return alarmDate >= startDate && alarmDate <= endDate;
      });

      // Group the alarms by date and count the number of alarms for each date
      const chartData = {};
      filteredAlarms.forEach((alarm) => {
        const dateStr = alarm.date.toISOString().split('T')[0];
        if (chartData[dateStr]) {
          chartData[dateStr]++;
        } else {
          chartData[dateStr] = 1;
        }
      });

      // Prepare the data in the required format for the chart
      const labels = Object.keys(chartData);
      const alarmCounts = Object.values(chartData);

      res.json({ labels, alarmCounts });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve chart data' });
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



/////////////////////////////////////////

// Task creation route
app.get('/create-task', (req, res) => {
  const user = req.user;
  res.render('create-task', { user });
});

app.post('/create-task', (req, res) => {
  const { task, coins } = req.body;
  const user = req.user;
  user.tasks.push({ task, coins });
  user.save();
  res.redirect('/dashboard');
});

// Reward creation route
app.get('/create-reward', (req, res) => {
  const user = req.user;
  res.render('create-reward', { user });
});

app.post('/create-reward', (req, res) => {
  const { reward, cost } = req.body;
  const user = req.user;
  user.rewards.push({ reward, cost });
  user.save();
  res.redirect('/dashboard');
});

// Shared page route
app.get('/shared/:userId', (req, res) => {
  const userId = req.params.userId;
  User.findById(userId, (err, user) => {
    if (err || !user) {
      res.render('shared', { error: 'Invalid link' });
    } else {
      res.render('shared', { user });
    }
  });
});

// Task completion route
app.post('/complete-task/:userId/:taskId', (req, res) => {
  const { userId, taskId } = req.params;
  User.findById(userId, (err, user) => {
    if (err || !user) {
      res.redirect('/');
    } else {
      const task = user.tasks.id(taskId);
      if (task) {
        // Add coins to user's account
        user.coins += task.coins;
        user.save();
        // Remove the completed task
        task.remove();
      }
      res.redirect(`/shared/${userId}`);
    }
  });
});

// Reward purchase route
app.post('/buy-reward/:userId/:rewardId', (req, res) => {
  const { userId, rewardId } = req.params;
  User.findById(userId, (err, user) => {
    if (err || !user) {
      res.redirect('/');
    } else {
      const reward = user.rewards.id(rewardId);
      if (reward && user.coins >= reward.cost) {
        // Deduct coins from user's account
        user.coins -= reward.cost;
        user.save();
        // Remove the purchased reward
        reward.remove();
      }
      res.redirect(`/shared/${userId}`);
    }
  });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Create task list route
app.get('/create-task-list', (req, res) => {
  res.render('create-task-list');
});

// Save task list route
app.post('/save-task-list', async (req, res) => {
  const taskListName = req.body.taskListName;
  const tasks = [];

  // Extract tasks and coins from request body
  for (let i = 1; i <= req.body.taskCount; i++) {
    const taskName = req.body[`task${i}Name`];
    const taskCoins = parseInt(req.body[`task${i}Coins`]);
    tasks.push({ task: taskName, coins: taskCoins });
  }

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.taskLists.push({ name: taskListName, tasks: tasks });
      await user.save();
      res.redirect('/dashboard');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/dashboard');
  }
});

// Create reward list route
app.get('/create-reward-list', (req, res) => {
  res.render('create-reward-list');
});

// Save reward list route
app.post('/save-reward-list', async (req, res) => {
  const rewardListName = req.body.rewardListName;
  const rewards = [];

  // Extract rewards and costs from request body
  for (let i = 1; i <= req.body.rewardCount; i++) {
    const rewardName = req.body[`reward${i}Name`];
    const rewardCost = parseInt(req.body[`reward${i}Cost`]);
    rewards.push({ reward: rewardName, cost: rewardCost });
  }

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.rewardLists.push({ name: rewardListName, rewards: rewards });
      await user.save();
      res.redirect('/dashboard');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/dashboard');
  }
});

// Remove task list route
app.post('/remove-task-list', async (req, res) => {
  const taskListId = req.body.taskListId;

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const taskList = user.taskLists.id(taskListId);
      if (taskList) {
        taskList.remove();
        await user.save();
        console.log('Task list removed successfully');
        res.status(200).json({ success: true, message: 'Task list removed successfully' });
      } else {
        console.log('Task list not found');
        res.status(404).json({ success: false, message: 'Task list not found' });
      }
    } else {
      console.log('User not found');
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error occurred while removing the task list:', error);
    res.status(500).json({ success: false, message: 'An error occurred while removing the task list' });
  }
});

// Remove reward list route
app.post('/remove-reward-list', async (req, res) => {
  const rewardListId = req.body.rewardListId;

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const rewardList = user.rewardLists.id(rewardListId);
      if (rewardList) {
        rewardList.remove();
        await user.save();
        console.log('Reward list removed successfully');
        res.status(200).json({ success: true, message: 'Reward list removed successfully' });
      } else {
        console.log('Reward list not found');
        res.status(404).json({ success: false, message: 'Reward list not found' });
      }
    } else {
      console.log('User not found');
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error occurred while removing the reward list:', error);
    res.status(500).json({ success: false, message: 'An error occurred while removing the reward list' });
  }
});

// Remove task list route
app.post('/remove-task-list', async (req, res) => {
  const taskListId = req.body.taskListId;

  console.log('Received request to remove task list with ID:', taskListId);

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const taskListIndex = user.taskLists.findIndex((taskList) => taskList._id.toString() === taskListId);
      if (taskListIndex !== -1) {
        user.taskLists.splice(taskListIndex, 1);
        await user.save();
        console.log('Task list removed successfully');
        res.status(200).json({ success: true, message: 'Task list removed successfully' });
      } else {
        console.log('Task list not found');
        res.status(404).json({ success: false, message: 'Task list not found' });
      }
    } else {
      console.log('User not found');
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error occurred while removing the task list:', error);
    res.status(500).json({ success: false, message: 'An error occurred while removing the task list' });
  }
});



// Remove reward list route
app.post('/remove-reward-list', async (req, res) => {
  const rewardListId = req.body.rewardListId;

  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const rewardListIndex = user.rewardLists.findIndex((rewardList) => rewardList._id.toString() === rewardListId);
      if (rewardListIndex !== -1) {
        user.rewardLists.splice(rewardListIndex, 1);
        await user.save();
        console.log('Reward list removed successfully');
        res.status(200).json({ success: true, message: 'Reward list removed successfully' });
      } else {
        console.log('Reward list not found');
        res.status(404).json({ success: false, message: 'Reward list not found' });
      }
    } else {
      console.log('User not found');
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error occurred while removing the reward list:', error);
    res.status(500).json({ success: false, message: 'An error occurred while removing the reward list' });
  }
});





// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
