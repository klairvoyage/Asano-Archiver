// File: app.js
const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Bottleneck = require('bottleneck');
const cheerio = require('cheerio');
const app = express();

// Set up static file serving and JSON parsing
app.use(express.static('public'));
app.use(express.json());

// Create a directory for downloads if it doesn't exist
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

// Browser impersonation headers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://kemono.su/',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin'
};

// Rate limiter for API requests to kemono.su
const apiLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000 // Wait at least 2 seconds between requests
});

// Rate limiter for file downloads
const downloadLimiter = new Bottleneck({
  maxConcurrent: 1, 
  minTime: 5000 // Wait at least 5 seconds between file downloads
});

// Fetch posts with pagination
app.get('/api/posts', async (req, res) => {
  try {
    const creatorId = '22614979';
    const service = 'patreon';
    const offset = parseInt(req.query.offset) || 0;
    
    // Use the updated API endpoint format
    const url = `https://kemono.su/api/v1/${service}/user/${creatorId}/posts-legacy?o=${offset}&limit=50`;
    console.log(`Fetching from: ${url}`);
    
    // Use the rate limiter to make the request
    const response = await apiLimiter.schedule(() => axios.get(url, { 
      headers: HEADERS,
      httpsAgent: new https.Agent({ keepAlive: true })
    }));
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching posts:', error.message);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get details of a specific post including files
app.get('/api/post/:id', async (req, res) => {
  try {
    const creatorId = '22614979';
    const service = 'patreon';
    const postId = req.params.id;
    
    // First try the API endpoint
    const apiUrl = `https://kemono.su/api/v1/${service}/user/${creatorId}/post/${postId}`;

    try {
      // Try the API first
      const apiResponse = await apiLimiter.schedule(() => axios.get(apiUrl, {
        headers: HEADERS,
        httpsAgent: new https.Agent({ keepAlive: true })
      }));

      // If we got data via API, format and return it
      if (apiResponse.data) {
        // Format according to what your frontend expects
        const files = (apiResponse.data.attachments || [])
          .filter(attachment => attachment.name.toLowerCase().endsWith('.pdf'))
          .map(attachment => ({
            name: attachment.name,
            url: `https://kemono.su/data/${attachment.path}`
          }));

        res.json({
          id: postId,
          title: apiResponse.data.title || '',
          content: apiResponse.data.content || '',
          files
        });
        return;
      }
    } catch (apiError) {
      console.log('API endpoint failed, falling back to HTML scraping');
    }

    // Fallback to HTML scraping if API failed
    const htmlUrl = `https://kemono.su/${service}/user/${creatorId}/post/${postId}`;

    // Use the rate limiter to make the request
    const response = await apiLimiter.schedule(() => axios.get(htmlUrl, {
      headers: HEADERS,
      httpsAgent: new https.Agent({ keepAlive: true })
    }));
    
    const $ = cheerio.load(response.data);
    const files = [];
    
    // Extract file information using cheerio
    $('.post__attachment').each((i, el) => {
      const link = $(el).find('a').attr('href');
      const name = $(el).find('a').text().trim();
      if (link && name.toLowerCase().endsWith('.pdf')) {
        files.push({
          name,
          url: link.startsWith('http') ? link : `https://kemono.su${link}`
        });
      }
    });
    
    res.json({ 
      id: postId,
      title: $('.post__title').text().trim(),
      content: $('.post__content').html(),
      files
    });
  } catch (error) {
    console.error(`Error fetching post ${req.params.id}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch post details' });
  }
});

// Endpoint to download a file
app.post('/api/download', async (req, res) => {
  const { url, filename } = req.body;
  
  if (!url || !filename) {
    return res.status(400).json({ error: 'URL and filename are required' });
  }
  
  try {
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const fullPath = path.join(downloadDir, sanitizedFilename);
    
    // Check if file already exists
    if (fs.existsSync(fullPath)) {
      return res.json({ success: true, message: 'File already exists', path: sanitizedFilename });
    }
    
    // Schedule download with rate limiting
    await downloadLimiter.schedule(async () => {
      // Create a write stream
      const writer = fs.createWriteStream(fullPath);
      
      // Download the file with proper headers
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: HEADERS,
        httpsAgent: new https.Agent({ keepAlive: true })
      });
      
      // Pipe the response to the file
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    });
    
    res.json({ success: true, message: 'File downloaded successfully', path: sanitizedFilename });
  } catch (error) {
    console.error('Error downloading file:', error.message);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Serve the downloaded file
app.get('/downloads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(downloadDir, filename);
  
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
