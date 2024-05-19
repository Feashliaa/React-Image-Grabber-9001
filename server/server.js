import express from 'express';
import path from 'path';
import puppeteer from 'puppeteer';
import userAgents from 'user-agents';
import fs from 'fs';
import cheerio from 'cheerio';
import axios from 'axios';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors({
    origin: 'http://localhost:5173/',
    optionsSuccessStatus: 200
}));

// Set cache control headers for static files
app.use(express.static(path.join(), {
    maxAge: '0', // No cache
    etag: false, // Disable ETag
    lastModified: false, // Disable Last-Modified
}));

// Define a directory for caching images
const cacheDirectory = path.join('imageCache');

// Create cache directory if it doesn't exist
if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory);
}

// Function to save image to cache
async function saveImageToCache(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const imageName = url.split('/').pop(); // Extract image name from URL
    const imagePath = path.join(cacheDirectory, imageName);
    await page.screenshot({ path: imagePath });
    await browser.close();
    return imagePath;
}

async function saveVideoToCache(url) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    const videoName = url.split('/').pop(); // Extract video name from URL
    const videoPath = path.join(cacheDirectory, videoName);
    const writer = fs.createWriteStream(videoPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(videoPath));
        writer.on('error', reject);
    });
}
// Function to delete cached image
async function deleteCachedImage(imagePath) {
    try {
        await fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Error deleting cached image:', err);
            } else {
                console.log('Cached image deleted successfully');
            }
        });
    } catch (error) {
        console.error('Error deleting cached image:', error);
    }
}

// Root URL handler
app.get('/', (req, res) => {
    res.send('Hello, welcome to the ImageGrabber API!');
});

app.get('/randomMeme', cors(), async (req, res) => {
    console.log('Fetching random meme...');
    try {

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--start-maximized', '--disable-web-security']
        });

        const page = await browser.newPage();

        const userAgentObject = userAgents.random();
        const randomUserAgent = userAgentObject.data.userAgent;
        console.log('Random User Agent:', randomUserAgent);
        await page.setUserAgent(randomUserAgent);

        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1280, height: 800 },
        ];
        const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
        await page.setViewport(randomViewport);

        await page.setBypassCSP(true);

        const firstPageURL = 'https://9gag.com/shuffle';
        console.log('Navigating to:', firstPageURL);
        await page.goto(firstPageURL);

        const maxRetries = 5;
        let retries = 0;
        let cloudflareResolved = false;

        // check if there is a cloudflare block
        if (page.url().includes('cloudflare')) {
            const waitForCloudflareResolve = async () => {
                while (retries < maxRetries && !cloudflareResolved) {
                    try {
                        await page.waitForSelector('a[href="https://9gag.com/shuffle"]', { timeout: 100 });
                        console.log('Cloudflare resolved, proceeding...');
                        cloudflareResolved = true;
                    } catch (error) {
                        console.error('Cloudflare block detected, refreshing page...');
                        retries++;
                        await page.reload({ waitUntil: 'domcontentloaded' });
                    }
                }
            };

            await waitForCloudflareResolve();

            if (!cloudflareResolved) {
                throw new Error('Max retries reached, failed to resolve Cloudflare block.');
            }
        }

        // grab the current url
        const currentURL = page.url();
        console.log('Current URL:', currentURL);


        let content = await page.content('.post-container');
        let $ = cheerio.load(content);
        let postContainer = $('.post-container');

        let imagePostElement = postContainer.find('.post-container img');
        let videoPostElement = postContainer.find('.post-container video');

        if (postContainer.length === 0) {
            throw new Error('Post container not found');
        }
        else {
            let mediaUrl = '';

            console.log('Image Post Element:', imagePostElement.length);
            console.log('Video Post Element:', videoPostElement.length);

            for (let i = 0; i < imagePostElement.length; i++) {
                let imagePostLink = imagePostElement.attr('src');
                console.log('Image Post Link:', imagePostLink);
            }

            let sourceElements = videoPostElement.find('source');

            for (let i = 0; i < sourceElements.length; i++) {
                let videoPostLink = sourceElements.eq(i).attr('src');
                console.log('Video Post Link:', videoPostLink);
            }

            let imagePostLink = imagePostElement.attr('src');

            if (imagePostElement.length > 0 && !imagePostLink.includes('thumbnail-facebook')) {
                // check if the link contains the line "thumbnail-facebook",
                // if so, remove it, and set the next link as the mediaUrl

                console.log('Image Post Link:', imagePostLink);
                console.log('Includes thumbnail-facebook:', imagePostLink.includes('thumbnail-facebook'));
                if (imagePostLink.includes('thumbnail-facebook')) {
                    res.json({ success: false, error: 'Image link contains "thumbnail-facebook"' });
                } else {
                    mediaUrl = imagePostElement.attr('src');
                    console.log('Media URL:', mediaUrl);

                    // check if theres an existing cached image
                    fs.readdir(cacheDirectory, async (err, files) => {
                        if (err) {
                            console.error('Error reading directory:', err);
                            return;
                        }
                        console.log('Files in cache directory:', files);
                        if (files && files.length > 0) {
                            console.log('Cached Files:', files);
                            // Delete the existing cached image
                            const imagePathToDelete = path.join(cacheDirectory, files[0]);
                            await deleteCachedImage(imagePathToDelete);
                        }
                        await saveImageToCache(mediaUrl);
                        res.json({ success: true, mediaUrl, currentURL });
                    });
                }
            } else if (videoPostElement.length > 0) {
                // Assuming videoPostElement represents the <video> element
                let sourceElements = videoPostElement.find('source'); // Select all <source> elements inside the <video> element
                // return the first video source link
                mediaUrl = sourceElements.eq(0).attr('src');
                console.log('Media URL:', mediaUrl);

                // check if theres an existing cached image
                fs.readdir(cacheDirectory, async (err, files) => {
                    if (err) {
                        console.error('Error reading directory:', err);
                        return;
                    }
                    console.log('Files in cache directory:', files);
                    if (files && files.length > 0) {
                        console.log('Cached Files:', files);
                        // Delete the existing cached image
                        const imagePathToDelete = path.join(cacheDirectory, files[0]);
                        await deleteCachedImage(imagePathToDelete);
                    }
                    await saveVideoToCache(mediaUrl);
                    res.json({ success: true, mediaUrl, currentURL });
                });
            } else {
                console.log('Image Post Element is filled with thumbnail-facebook, gotta try again');
                res.json({ success: false, error: 'Image link contains "thumbnail-facebook"' });
            }
        }
        await browser.close();
    } catch (error) {
        console.error('Error fetching random media:', error);
        res.json({ success: false, error: error.message });
    }
});


app.get('/downloadImage', cors(), async (req, res) => {
    try {
        // Check if there's an existing cached image
        fs.readdir(cacheDirectory, async (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return;
            }

            // Process the files array here
            console.log('Files in cache directory:', files);

            // Check if any files are cached
            if (files && files.length > 0) {
                console.log('Cached Files:', files);

                // Send the first cached image as a response
                const imagePath = path.join(cacheDirectory, files[0]);

                console.log('Image Path:', imagePath);

                // send the image as a response
                res.download(imagePath);
            } else {
                res.status(404).json({ success: false, error: 'No images found' });
            }
        });
    } catch (error) {
        console.error('Error downloading image:', error);
        res.status(500).json({
            success: false, error: 'Internal server error',
            message: error.message, stack: error.stack
        });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});