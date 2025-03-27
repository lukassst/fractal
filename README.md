# Medical Image Viewer

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (recommended)
- OR any simple HTTP server (Python, etc.)

### Setup with Node.js
1. Install a simple HTTP server globally:
```bash
npm install -g http-server
```

2. Navigate to the project directory:
```bash
cd path/to/project
```

3. Start the server:
```bash
http-server -p 8000
```

4. Open your browser and go to:
```
http://localhost:8000
```

### Alternative: Using Python
```bash
# Python 3.x
python -m http.server 8000

# Python 2.x
python -m SimpleHTTPServer 8000
```

## Setting Up Local Libraries

### Easiest Method: Using the Setup Script

1. Run the setup script to download all required libraries:
```bash
npm run setup-libs
```

This will download Papaya and Daikon directly from their GitHub repositories and place them in the correct location.

### Alternative: Manual Download

1. Create a `lib` directory in the project root:
```bash
mkdir lib
```

2. Download the library files directly:
   - Papaya JS: https://raw.githubusercontent.com/rii-mango/Papaya/master/release/papaya.js
   - Papaya CSS: https://raw.githubusercontent.com/rii-mango/Papaya/master/release/papaya.css
   - Daikon JS: https://raw.githubusercontent.com/rii-mango/Daikon/master/release/daikon.js

3. Save all files to the `lib` directory

### Verifying the Setup

After installing the libraries, your directory structure should look like:
```
frac2/
├── lib/
│   ├── papaya.js
│   ├── papaya.css
│   └── daikon.js
├── index.html
├── viewer.js
└── styles.css
```

### Troubleshooting

If you encounter 404 errors:
1. Make sure the library files are in the correct directories
2. Check that the paths in index.html match your directory structure
3. Try using the CDN links temporarily until local files are properly set up

## Troubleshooting Common Errors

- **daikon.js Error:**  
  "Uncaught SyntaxError: Unexpected token '<'"  
  This means that instead of getting JavaScript, the browser is receiving an HTML page (often a 404 error).  
  • Verify that the file `lib/daikon.js` exists.  
  • Check the `<script src="...">` path in index.html to be sure it correctly points to `lib/daikon.js`.

- **viewer.js Error:**  
  "Uncaught SyntaxError: Identifier 'papayaContainers' has already been declared"  
  This suggests that viewer.js is being loaded more than once.  
  • Ensure that your index.html contains only one `<script src="viewer.js"></script>` tag.  
  • Confirm that no other mechanism is causing viewer.js to run multiple times.

## Usage
- Use the format selection dropdown to choose between NIFTI and DICOM formats
- Click the file input to upload medical images
- Use "Load Sample Images" to view demo data
- Toggle synchronization between panels using "Disable/Enable Sync"
- Reset views with the "Reset View" button

## Controls Explained

### Reset View Button
- Resets all viewer panels to their default visualization state
- Specifically:
  - Returns pan/zoom levels to defaults
  - Resets any contrast or brightness adjustments
  - Explicitly centers the view on the volume's center point
  - Returns to the initial slice position
- Important: Does NOT remove or reload the currently displayed images
- Affects all panels simultaneously

### Disable/Enable Sync Button
- Toggles synchronization between the four viewer panels
- When enabled (default): Moving through slices in one panel will automatically update the corresponding slice position in all other panels with loaded images
- When disabled: Each panel can be navigated independently
- Button text changes between "Disable Sync" and "Enable Sync" depending on current state

### Load Sample Images Button
- Loads different pre-defined sample neuroimaging datasets into the four panels:
  - Panel 1: Standard sample image (sample_image.nii.gz)
  - Panel 2: DTI image (dti.nii.gz)
  - Panel 3: Functional MRI image (functional.nii.gz)
  - Panel 4: Z-statistic map (zstat1.nii.gz)
- All samples are loaded from the Papaya repository: https://github.com/rii-mango/Papaya/tree/master/tests/data
- Useful for testing the viewer functionality without uploading your own files

## Viewer Configuration

The medical image viewer is configured to:
- Display only axial slices in all panels
- Hide orientation cube and 3D view controls
- Allow mouse wheel navigation through image slices
- Enable synchronized navigation between panels by default

## Development Notes
- Edit HTML, CSS and JS files directly - no build step required
- Refresh the browser to see changes
- Check browser console (F12) for Papaya debug messages

## Browser Console Warnings

### Non-Passive Event Listeners Warning
You may see this warning in your browser console:

## Deployment Options

### Option 1: GitHub Pages (Easiest, Free)

1. Create a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/medical-image-viewer.git
   git push -u origin main
   ```

2. In your GitHub repository settings, enable GitHub Pages:
   - Go to your repository page on GitHub
   - Click "Settings" tab at the top right
   - Scroll down to "GitHub Pages" section (or click on "Pages" in the left sidebar)
   - Under "Source", select "Deploy from a branch" 
   - From the branch dropdown, select "main"
   - For the folder, select "/ (root)"
   - Click "Save"
   - Your site will be published at `https://yourusername.github.io/medical-image-viewer/`
   - Note: It may take a few minutes for your site to be deployed
