const express = require('express');
const redis = require('redis');
const Queue = require('bull');
const { Pipeline } = require("./Pipeline");
const { joinWordsFilter, toUpperCaseFilter, addFullStopFilter, trimFilter } = require("./filters");

const app = express();
const port = 3000;

// Redis client and Bull job queue
const redisClient = redis.createClient();
const jobQueue = new Queue('job_queue', { redis: redisClient });

redisClient.on('connect', function() {
  console.log('Connected to Redis');
});

redisClient.on('error', function(err) {
  console.error('Redis error:', err);
});

// Bull job processor
async function jobProcessor(job, done) {
  console.log(`Processing job ${job.id}`);
  const data = job.data;
  
  // Apply filters
  var pipeline = new Pipeline();

  pipeline.use(joinWordsFilter);
  pipeline.use(trimFilter);
  pipeline.use(toUpperCaseFilter);
  pipeline.use(addFullStopFilter);

  const message = pipeline.run(data);
  
  // Send the processed data to Redis or another data store
  await redisClient.connect();
  try {
    await redisClient.set(`job_${job.id}`, message);
  } catch (err) {
    console.log(err);
    done(err);
  } finally {
    redisClient.quit();
  }
  console.log(`Job ${job.id} completed`);
  done();
}

// Register the job processor with the job queue
jobQueue.process(jobProcessor);

// Middleware to parse JSON request bodies
app.use(express.json());

// Route to add a job to the job queue
app.post('/jobs', async (req, res) => {
  const { data } = req.body;
  if (!data) {
    res.status(400).send('Job data is required');
    return;
  }

  // Add the job to the job queue
  const job = await jobQueue.add(data);
  
  res.json({ id: job.id });
});

app.get('/jobs/:id/state', async (req, res) => {
  const { id } = req.params;
  const job = await jobQueue.getJob(id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const state = await job.getState();
  res.json({ state });
});

app.get('/jobs/:id', async (req, res) => {
  const jobId = req.params.id;

  // Get the processed job data from Redis
  await redisClient.connect();
  try {
    const value = await redisClient.get(`job_${jobId}`);
    if (!value) {
      return res.status(404).json({ error: 'Data not found' });
    }
    res.send(value);
  } catch (err) {
    res.status(500).send(err.message);
  } finally {
    redisClient.quit();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
