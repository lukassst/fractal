(function() {
// Initialize Papaya medical image viewer application
let viewers = [];
let syncEnabled = true;

// Configuration for each Papaya viewer
const papayaContainers = [
    { id: "papaya-viewer-0", allowPropagation: true },
    { id: "papaya-viewer-1", allowPropagation: true },
    { id: "papaya-viewer-2", allowPropagation: true },
    { id: "papaya-viewer-3", allowPropagation: true }
];

// Global parameters and configuration
const params = [];
params.worldSpace = true; // Default to world space coordinates
params.fullScreen = false;
params.showControls = false;
params.allowScroll = true;
//params.orthogonal = false;
//params.mainView = "axial";


// Initialize Papaya viewers
function initPapayaViewers() {
    papayaContainers.forEach((container, index) => {
        // Each viewer gets its own params
        container.params = Object.assign({}, params);
        container.params.kioskMode = true;
        container.smoothDisplay = true;
    });
    
    // Init the viewers
    papaya.Container.startPapaya();
    
    // Wait for viewers to be fully initialized
    waitForViewersToLoad();
}

// Wait for Papaya viewers to be fully initialized
function waitForViewersToLoad() {
    // Check if viewers are loaded
    if (papaya.Container.viewers && 
        Object.keys(papaya.Container.viewers).length === papayaContainers.length) {
        
        // Store references to the viewers
        papayaContainers.forEach((container, index) => {
            const viewerIndex = "papaya-viewer-" + index;
            viewers[index] = papaya.Container.viewers[viewerIndex];
        });

        // Set up synchronization observers
        setupSynchronization();
        console.log("Papaya viewers initialized successfully");
    } else {
        // Check again after a short delay
        setTimeout(waitForViewersToLoad, 100);
    }
}

// Setup synchronization between viewers
function setupSynchronization() {
    for (let i = 0; i < viewers.length; i++) {
        if (viewers[i]) {
            viewers[i].viewer.addEventListener('sliceLocationChange', function(e) {
                if (!syncEnabled) return;
                
                const sourceViewer = i;
                const sliceCoords = viewers[sourceViewer].getCurrentCoordinates();
                
                // Sync slice position to other viewers
                for (let j = 0; j < viewers.length; j++) {
                    if (j !== sourceViewer && viewers[j] && viewers[j].volume) {
                        viewers[j].gotoCoordinate(sliceCoords);
                    }
                }
            });
        }
    }
}

// Load NIFTI file
function loadNiftiFile(viewerIndex, file) {
    console.log(`Loading NIFTI file into viewer ${viewerIndex}`, file);
    // Create a unique file ID
    const fileId = 'nifti-' + viewerIndex + '-' + Date.now();
    
    // Add file to papaya
    papaya.Container.addImage(viewerIndex, file, { name: fileId });
}

// Load DICOM files
function loadDicomFiles(viewerIndex, files) {
    console.log(`Loading ${files.length} DICOM files into viewer ${viewerIndex}`);
    // Convert DICOM to Papaya readable format using daikon
    const fileReader = new FileReader();
    const dicomDatasets = [];
    
    let filesProcessed = 0;
    
    // Process each DICOM file
    function processNextFile(index) {
        if (index >= files.length) {
            // All files processed, create a volume
            const volume = daikon.Series.create(dicomDatasets);
            const header = volume.getHeaderData();
            
            // Convert daikon series to arraybuffer
            const buffer = volume.getInterpretedData();
            
            // Create papaya params for this volume
            const params = {
                name: 'dicom-' + viewerIndex,
                numSlices: volume.images.length,
                width: volume.getRows(),
                height: volume.getCols()
            };
            
            // Load data into papaya
            papaya.Container.viewers[viewerIndex].loadBaseImage({
                data: buffer,
                ...params
            });
            
            return;
        }
        
        const file = files[index];
        fileReader.onload = function() {
            try {
                const data = new DataView(fileReader.result);
                const image = daikon.Series.parseImage(data);
                
                if (image) {
                    dicomDatasets.push(image);
                }
                
                filesProcessed++;
                processNextFile(index + 1);
            } catch (error) {
                console.error('Error processing DICOM file:', error);
                processNextFile(index + 1);
            }
        };
        
        fileReader.readAsArrayBuffer(file);
    }
    
    processNextFile(0);
}

// Handle file input changes
function handleFileInput(viewerIndex, files) {
    const formatSelect = document.getElementById('format' + (viewerIndex + 1));
    const format = formatSelect.value;
    
    if (format === 'nifti' && files.length > 0) {
        loadNiftiFile(viewerIndex, files[0]);
    } else if (format === 'dicom' && files.length > 0) {
        loadDicomFiles(viewerIndex, files);
    }
}

// Load sample images for demonstration
function loadSampleImages() {
    // Sample NIFTI URLs from the Papaya GitHub repository
    const sampleUrls = [
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz'
    ];
    
    // Load samples into each viewer
    for (let i = 0; i < sampleUrls.length; i++) {
        const params = [];
        params['worldSpace'] = true;
        params['images'] = [sampleUrls[i]];
        
        papaya.Container.resetViewer(i, params);
    }
}

// Reset all viewers
function resetViewers() {
    console.log("Reset button clicked, resetting viewers...");
    try {
        for (let i = 0; i < viewers.length; i++) {
            if (viewers[i]) {
                console.log(`Resetting viewer ${i}...`);
                
                // Basic reset - should work even without a volume
                viewers[i].resetViewer();
                
                // Only try to center if we have a volume loaded
                if (viewers[i].volume) {
                    console.log(`Centering viewer ${i} on volume center`);
                    try {
                        const center = viewers[i].volume.getVolumeCenter();
                        viewers[i].gotoCoordinate(center);
                        viewers[i].drawViewer(true, false);
                    } catch (volumeError) {
                        console.error(`Error centering viewer ${i}:`, volumeError);
                    }
                }
            }
        }
        // As a fallback, try the direct Papaya API
        for (let i = 0; i < papayaContainers.length; i++) {
            try {
                papaya.Container.resetViewer(i);
                console.log(`Applied fallback reset to viewer ${i}`);
            } catch (e) {
                console.warn(`Fallback reset failed for viewer ${i}:`, e);
            }
        }
    } catch (error) {
        console.error("Error in resetViewers:", error);
    }
}

// Resize functionality for sidebars
function initResizableSidebars() {
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    const leftHandle = document.getElementById('left-resize-handle');
    const rightHandle = document.getElementById('right-resize-handle');
    
    let isResizing = false;
    let currentHandle = null;
    let initialX = 0;
    let initialWidth = 0;
    
    // Event Listeners for Left Handle
    if (leftHandle && leftSidebar) {
        leftHandle.addEventListener('mousedown', function(e) {
            startResize(e, leftSidebar);
        });
    }
    
    // Event Listeners for Right Handle
    if (rightHandle && rightSidebar) {
        rightHandle.addEventListener('mousedown', function(e) {
            startResize(e, rightSidebar);
        });
    }
    
    function startResize(e, sidebar) {
        isResizing = true;
        currentHandle = e.target;
        initialX = e.clientX;
        initialWidth = sidebar.offsetWidth;
        
        // Add class to handle
        currentHandle.classList.add('active');
        document.body.classList.add('resizing');
        
        // Add event listeners for mouse movement and release
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
        
        // Prevent default behavior
        e.preventDefault();
    }
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const container = document.querySelector('.container');
        const containerWidth = container.offsetWidth;
        
        if (currentHandle.classList.contains('left-resize-handle')) {
            // Resizing left sidebar
            let newWidth = initialWidth + (e.clientX - initialX);
            
            // Enforce min and max width as percentage of container
            const minWidth = 100;
            const maxWidth = containerWidth * 0.3; // 30% of container width
            
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            leftSidebar.style.width = newWidth + 'px';
            
        } else if (currentHandle.classList.contains('right-resize-handle')) {
            // Resizing right sidebar
            let newWidth = initialWidth - (e.clientX - initialX);
            
            // Enforce min and max width as percentage of container
            const minWidth = 100;
            const maxWidth = containerWidth * 0.3; // 30% of container width
            
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            rightSidebar.style.width = newWidth + 'px';
        }
        
        // Redraw viewers if needed
        if (viewers && viewers.length > 0) {
            viewers.forEach(viewer => {
                if (viewer && viewer.drawViewer) {
                    try {
                        viewer.drawViewer(true, false);
                    } catch (e) {
                        // Ignore errors during resize
                    }
                }
            });
        }
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
            
            if (currentHandle) {
                currentHandle.classList.remove('active');
                currentHandle = null;
            }
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResize);
            
            // Force redraw of all viewers after resize is complete
            if (viewers && viewers.length > 0) {
                setTimeout(() => {
                    viewers.forEach(viewer => {
                        if (viewer && viewer.drawViewer) {
                            try {
                                viewer.drawViewer(true, false);
                            } catch (e) {
                                // Ignore errors
                            }
                        }
                    });
                }, 300);
            }
        }
    }
}

// Event handling on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Papaya viewers
    initPapayaViewers();
    
    // Initialize resizable sidebars
    initResizableSidebars();
    
    // Set up file inputs
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`file${i}`).addEventListener('change', function(e) {
            handleFileInput(i-1, e.target.files);
        });
    }
    
    // Set up synchronization toggle
    document.getElementById('toggle-sync').addEventListener('click', function() {
        syncEnabled = !syncEnabled;
        this.textContent = syncEnabled ? 'Disable Sync' : 'Enable Sync';
    });
    
    // Reset view button - with error handling
    const resetButton = document.getElementById('reset');
    if (resetButton) {
        resetButton.addEventListener('click', function(e) {
            console.log("Reset button clicked");
            resetViewers();
        });
    } else {
        console.error("Reset button not found in the DOM");
    }
    
    // Load sample button
    document.getElementById('load-sample').addEventListener('click', loadSampleImages);
});

// Enable verbose Papaya logging
papaya.debug = true;
})();
