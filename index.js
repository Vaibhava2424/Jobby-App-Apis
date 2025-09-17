import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { sign, verify } = jwt;
const app = express();

// ---------- CORS ----------
app.use(cors({
  origin: "http://localhost:3000", // frontend origin
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 5001;

// ------------------ User Schema ------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ------------------ Job Schema ------------------
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company_logo_url: { type: String },
  rating: { type: Number, default: 0 },
  job_description: { type: String, required: true },
  location: { type: String, required: true },
  employment_type: { type: String, required: true },
  package_per_annum: { type: String, required: true },
  company_website_url: { type: String, default: "" },
  life_at_company: {
    description: { type: String, default: "" },
    image_url: { type: String, default: "" }
  },
  skills: [
    {
      name: { type: String, default: "" },
      image_url: { type: String, default: "" }
    }
  ]
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

// ------------------ Feedback Schema ------------------
const feedbackSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String },
  message: { type: String, required: true }
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);

// ------------------ Middleware ------------------
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ error: "Token missing" });

  try {
    const decoded = verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ------------------ Routes ------------------
app.get('/', (req, res) => {
  res.send('Jobby Backend is running!');
});

// ------------------ Auth Routes ------------------
// Signup
app.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;

  if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET is not set" });

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, email });
    await newUser.save();

    const token = sign({ id: newUser._id, username, email }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ message: "Signup successful", token });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET is not set" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = sign({ id: user._id, username: user.username, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Protected route to get logged-in user info
app.get('/protected', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, { password: 0 }); // exclude password
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get all users without token (NOT RECOMMENDED for production)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user by ID
app.delete('/api/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ------------------ Job Routes ------------------
app.post('/api/jobs', async (req, res) => {
  try {
    const jobs = req.body;
    if (Array.isArray(jobs)) {
      const createdJobs = await Job.insertMany(jobs);
      return res.status(201).json({ message: 'Jobs created successfully', jobs: createdJobs });
    } else {
      const job = new Job(jobs);
      await job.save();
      return res.status(201).json({ message: 'Job created successfully', job });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({}, {
      title: 1,
      company_logo_url: 1,
      rating: 1,
      job_description: 1,
      location: 1,
      employment_type: 1,
      package_per_annum: 1
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const deletedJob = await Job.findByIdAndDelete(req.params.id);
    if (!deletedJob) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ message: 'Job deleted successfully', job: deletedJob });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jobs', async (req, res) => {
  try {
    const result = await Job.deleteMany({});
    res.status(200).json({ message: 'All jobs deleted successfully', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ Feedback Routes ------------------
// Add feedback
app.post('/api/feedback', async (req, res) => {
  const { username, email, message } = req.body;
  if (!username || !message) return res.status(400).json({ error: "Username and message are required" });

  try {
    const feedback = new Feedback({ username, email, message });
    await feedback.save();
    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all feedbacks
app.get('/api/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({});
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete feedback by ID
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!deletedFeedback) return res.status(404).json({ message: 'Feedback not found' });
    res.status(200).json({ message: 'Feedback deleted successfully', feedback: deletedFeedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all feedbacks
app.delete('/api/feedback', async (req, res) => {
  try {
    const result = await Feedback.deleteMany({});
    res.status(200).json({ message: 'All feedbacks deleted successfully', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ Start Server ------------------
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set in environment variables!');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
