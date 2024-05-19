import React from 'react';
import Script from './Script';
import { handleDownloadLinkClick, handleGenerateImageButtonClick } from './Script';
import './Style.css';

function ImageGrabber() {
    return (

        <div className="container">

            <h1>Image Grabber 9001</h1>

            <div className="image-container">

                <img id="randomImage" style={{ display: 'none' }} />

                <video id="randomVideo" controls style={{ display: 'none' }}>
                    <source src="" type="video/webm" />
                    Your browser does not support the video tag.
                </video>

            </div>

            <div id="downloadLink" className="button"
                onClick={handleDownloadLinkClick}>Download Image</div>

            <div id="generateImageButton" className="button"
                onClick={handleGenerateImageButtonClick}>Fetch Image</div>

            {/* Include your Script component */}
            <Script />

        </div>
    );
}

export default ImageGrabber;
