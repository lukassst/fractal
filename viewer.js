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
    console.log(`Configuring synchronization (${syncEnabled ? 'ENABLED' : 'DISABLED'})`);
    
    // Remove existing listeners from all viewers
    viewers.forEach(viewer => {
        if (viewer && viewer._syncListeners) {
            viewer._syncListeners.forEach(listener => {
                if (listener.type === 'sliceChanged') {
                    viewer.removeSliceChangedListener(listener.handler);
                } else {
                    viewer.viewer.removeEventListener(listener.event, listener.handler);
                }
            });
            viewer._syncListeners = [];
        }
    });
    
    if (!syncEnabled) {
        console.log("Synchronization is now DISABLED");
        return;
    }
    
    // Function to sync other viewers from a source viewer
    function syncFromSource(sourceIndex) {
        if (!syncEnabled) return;
        const sourceViewer = viewers[sourceIndex];
        if (!sourceViewer || !sourceViewer.volume) return;
        const worldCoords = sourceViewer.getWorldCoordinates();
        viewers.forEach((viewer, index) => {
            if (index !== sourceIndex && viewer && viewer.volume) {
                viewer.gotoWorldCoordinate(worldCoords.x, worldCoords.y, worldCoords.z);
                viewer.drawViewer(true, false);
            }
        });
    }
    
    // Add event listeners to each viewer
    viewers.forEach((viewer, index) => {
        if (!viewer) return;
        viewer._syncListeners = [];
        
        // Mouse and wheel events for panning, zooming, and scrolling
        ['mousedown', 'mouseup', 'mousemove', 'wheel'].forEach(eventType => {
            const handler = () => syncFromSource(index);
            viewer.viewer.addEventListener(eventType, handler);
            viewer._syncListeners.push({ event: eventType, handler });
        });
        
        // Slice change listener if supported
        if (viewer.addSliceChangedListener) {
            const sliceHandler = () => syncFromSource(index);
            viewer.addSliceChangedListener(sliceHandler);
            viewer._syncListeners.push({ type: 'sliceChanged', handler: sliceHandler });
        }
    });
    
    console.log("✅ Synchronization is now ENABLED");
    
    // Initial sync after a delay to ensure volumes are loaded
    setTimeout(() => {
        if (syncEnabled && viewers.some(v => v && v.volume)) {
            syncFromSource(0); // Use first viewer with a volume as reference
        }
    }, 1000);
}

// Load NIFTI file
function loadNiftiFile(viewerIndex, file, fileNumber) {
    console.log(`Loading NIFTI file into viewer ${viewerIndex}`, file);
    
    try {
        // Show loading indicator
        const viewerElement = document.querySelector(`#papaya-viewer-${viewerIndex}`);
        if (viewerElement) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = '<span>Loading...</span>';
            viewerElement.appendChild(loadingDiv);
        }
        
        // Create a file reader to handle the file directly
        const reader = new FileReader();
        reader.onload = function() {
            try {
                console.log(`File ${file.name} read successfully, size: ${reader.result.byteLength} bytes`);
                
                // Use resetViewer with a params object that includes the loaded file data
                const params = [];
                params.lut = "Grayscale";
                params.worldSpace = true;
                
                // Create load callback for better tracking
                params.loadingComplete = function() {
                    console.log(`Image ${file.name} loaded successfully into viewer ${viewerIndex}`);
                    
                    // Update the panel header with the file number instead of the name
                    const headerElement = document.querySelector(`.viewer-container:nth-child(${viewerIndex + 1}) .viewer-header`);
                    if (headerElement) {
                        // If fileNumber is provided, display that, otherwise just show the panel number
                        headerElement.textContent = fileNumber 
                            ? `Panel ${viewerIndex + 1}: #${fileNumber}` 
                            : `Panel ${viewerIndex + 1}`;
                    }
                    
                    // Remove loading overlay
                    const loadingDiv = viewerElement?.querySelector('.loading-overlay');
                    if (loadingDiv) loadingDiv.remove();
                    
                    // Force a redraw of the viewer
                    if (viewers[viewerIndex] && viewers[viewerIndex].drawViewer) {
                        console.log(`Forcing redraw of viewer ${viewerIndex}`);
                        viewers[viewerIndex].drawViewer(true, false);
                    }
                };
                
                // Assign the binary data to the params object
                params.binaryImages = [reader.result];
                
                console.log(`Resetting viewer ${viewerIndex} and loading image...`);
                papaya.Container.resetViewer(viewerIndex, params);
                
                // Add fallback for loading indicator removal
                setTimeout(() => {
                    const loadingDiv = viewerElement?.querySelector('.loading-overlay');
                    if (loadingDiv) {
                        console.log("Removing loading overlay via timeout fallback");
                        loadingDiv.remove();
                    }
                }, 3000);
                
            } catch (error) {
                console.error('Error processing file data:', error);
                alert(`Error processing file: ${error.message || 'Unknown error'}`);
                
                // Remove loading indicator
                const loadingDiv = viewerElement?.querySelector('.loading-overlay');
                if (loadingDiv) loadingDiv.remove();
            }
        };
        
        // Handle read errors
        reader.onerror = function() {
            console.error('Error reading file:', reader.error);
            alert(`Error reading file: ${reader.error || 'Unknown error'}`);
            
            // Remove loading indicator
            const loadingDiv = viewerElement?.querySelector('.loading-overlay');
            if (loadingDiv) loadingDiv.remove();
        };
        
        // Read the file as an ArrayBuffer
        console.log(`Starting to read file ${file.name}...`);
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('Error in loadNiftiFile:', error);
        alert(`Failed to load file: ${error.message || 'Unknown error'}`);
        
        // Remove loading indicator
        const viewerElement = document.querySelector(`#papaya-viewer-${viewerIndex}`);
        if (viewerElement) {
            const loadingDiv = viewerElement.querySelector('.loading-overlay');
            if (loadingDiv) loadingDiv.remove();
        }
    }
}

// Load DICOM files
function loadDicomFiles(viewerIndex, files, fileNumber) {
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
            
            // Update panel header with file number
            const headerElement = document.querySelector(`.viewer-container:nth-child(${viewerIndex + 1}) .viewer-header`);
            if (headerElement) {
                // If fileNumber is provided, display that, otherwise just show the panel number
                headerElement.textContent = fileNumber 
                    ? `Panel ${viewerIndex + 1}: #${fileNumber}` 
                    : `Panel ${viewerIndex + 1}`;
            }
            
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
    console.log("Loading sample images into all viewers...");
    
    // Sample NIFTI URLs from the Papaya GitHub repository
    const sampleUrls = [
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz',
        'https://raw.githubusercontent.com/rii-mango/Papaya/master/tests/data/sample_image.nii.gz'
    ];
    
    // Clear tracking of loaded images
    let imagesLoaded = 0;
    
    // Create a global load callback to track when images are loaded
    window.papayaLoadCallback = function() {
        imagesLoaded++;
        console.log(`Image loaded (${imagesLoaded} of ${sampleUrls.length})`);
        
        // Check if all images are loaded
        if (imagesLoaded === sampleUrls.length) {
            console.log("✓ All images loaded successfully!");
            
            // In loadSampleImages(), replace the forceViewerSync() call
            setTimeout(() => {
                const volumesReady = viewers.filter(v => v && v.volume).length;
                console.log(`Found ${volumesReady} viewers with volumes ready`);
                if (syncEnabled && volumesReady > 0) {
                    syncFromSource(0); // Replace forceViewerSync()
                }
            }, 1000);
        }
    };
    
    // Load samples into each viewer
    for (let i = 0; i < sampleUrls.length; i++) {
        const params = [];
        params['worldSpace'] = true;
        params['images'] = [sampleUrls[i]];
        params['loadingComplete'] = window.papayaLoadCallback;
        
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
        
        // Check for table overflow during resize for immediate feedback
        const tbody = document.querySelector('.file-list-table tbody');
        if (tbody) {
            // Use requestAnimationFrame for smoother resize updates
            requestAnimationFrame(() => checkTableOverflow(tbody));
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
            
            // Force multiple checks after resize completes to ensure scrollbar shows correctly
            const tbody = document.querySelector('.file-list-table tbody');
            if (tbody) {
                // Check immediately 
                checkTableOverflow(tbody);
                
                // Check again after layout has settled
                setTimeout(() => checkTableOverflow(tbody), 50);
                setTimeout(() => checkTableOverflow(tbody), 300);
            }
        }
    }
}

// Load images from a directory
function loadDirectoryImages() {
    // Create an input element for directory selection
    const dirInput = document.createElement('input');
    dirInput.type = 'file';
    dirInput.webkitdirectory = true; // Chrome, Edge, Safari support
    dirInput.multiple = true;
    
    // Listen for file selection
    dirInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        console.log(`Selected ${files.length} files from directory`);
        
        // Group files by type
        const niftiFiles = files.filter(file => 
            file.name.endsWith('.nii') || file.name.endsWith('.nii.gz'));
        const dicomFiles = files.filter(file => 
            file.name.endsWith('.dcm') || file.name.toLowerCase().includes('dicom'));
        
        console.log(`Found ${niftiFiles.length} NIFTI files and ${dicomFiles.length} DICOM files`);
        
        // Create or get file list container
        let fileListContainer = document.getElementById('file-list-container');
        if (!fileListContainer) {
            fileListContainer = document.createElement('div');
            fileListContainer.id = 'file-list-container';
            fileListContainer.className = 'file-list-container';
            
            // Add to sidebar
            const sidebar = document.getElementById('left-sidebar');
            sidebar.appendChild(fileListContainer);
        }
        
        // Clear previous list (remove the Directory Contents header)
        fileListContainer.innerHTML = '';
        if (niftiFiles.length + dicomFiles.length === 0) {
            fileListContainer.innerHTML = '<p>No DICOM or NIFTI files found</p>';
            return;
        }
        
        // Create scroll container for horizontal scrolling
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'table-scroll-container';
        fileListContainer.appendChild(scrollContainer);
        
        // Create table for file list
        const table = document.createElement('table');
        table.className = 'file-list-table';
        scrollContainer.appendChild(table); // Add table to scroll container instead of directly to fileListContainer
        
        // Add table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add the numbering column header
        const headerNumberCell = document.createElement('th');
        headerNumberCell.textContent = '#';
        headerNumberCell.style.width = '40px'; // Give it a fixed width
        headerRow.appendChild(headerNumberCell);
        
        // Add the file/series name column header
        const headerCell1 = document.createElement('th');
        headerCell1.textContent = 'File/Series (Click to load)';
        headerRow.appendChild(headerCell1);
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        
        // Group files by folder for processing - important for DICOM series
        const filesByFolder = {};
        
        // Process NIFTI files - group by folder but will display flat 
        niftiFiles.forEach(file => {
            // Extract folder name from path
            const pathParts = file.webkitRelativePath.split('/');
            const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Root';
            
            if (!filesByFolder[folderName]) {
                filesByFolder[folderName] = { nifti: [], dicom: [] };
            }
            
            filesByFolder[folderName].nifti.push(file);
        });
        
        // Process DICOM files - group by folder/series
        dicomFiles.forEach(file => {
            // Extract folder name from path
            const pathParts = file.webkitRelativePath.split('/');
            const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Root';
            
            if (!filesByFolder[folderName]) {
                filesByFolder[folderName] = { nifti: [], dicom: [] };
            }
            
            filesByFolder[folderName].dicom.push(file);
        });
        
        // If we have DICOM files, process metadata
        if (dicomFiles.length > 0) {
            const promises = [];
            
            // Get metadata for one representative file per folder
            for (const folderName in filesByFolder) {
                if (filesByFolder[folderName].dicom.length > 0) {
                    const representativeFile = filesByFolder[folderName].dicom[0];
                    
                    promises.push(new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function() {
                            try {
                                const dataView = new DataView(reader.result);
                                const image = daikon.Series.parseImage(dataView);
                                
                                if (image) {
                                    const patientId = image.getPatientID() || 'Unknown';
                                    const seriesNum = image.getSeriesNumber() || 'Unknown';
                                    resolve({
                                        folder: folderName,
                                        metadata: {
                                            patientId,
                                            seriesNumber: seriesNum,
                                            displayName: `${patientId} - Series ${seriesNum}`
                                        }
                                    });
                                } else {
                                    resolve({ folder: folderName, metadata: null });
                                }
                            } catch (e) {
                                console.error('Error reading DICOM file metadata:', e);
                                resolve({ folder: folderName, metadata: null });
                            }
                        };
                        reader.readAsArrayBuffer(representativeFile);
                    }));
                }
            }
            
            // Once we have metadata, populate the table
            Promise.all(promises).then(results => {
                // Create metadata lookup
                const folderMetadata = {};
                results.forEach(result => {
                    if (result.metadata) {
                        folderMetadata[result.folder] = result.metadata;
                    }
                });
                
                // Populate table with all files and metadata
                populateSimplifiedFileTable(filesByFolder, folderMetadata, tbody);
            }).catch(error => {
                console.error('Error processing DICOM metadata:', error);
                // Still try to populate the table with whatever we have
                populateSimplifiedFileTable(filesByFolder, {}, tbody);
            });
        } else {
            // If only NIFTI files, populate immediately
            populateSimplifiedFileTable(filesByFolder, {}, tbody);
        }
    });
    
    // Trigger the file dialog
    dirInput.click();
}

// Helper function to populate the simplified file table (no directory column and no action button)
function populateSimplifiedFileTable(filesByFolder, folderMetadata, tbody) {
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Track if we found any files to display
    let filesFound = false;
    
    // Create a combined array of all files for sorting
    let allFiles = [];
    
    // Extract all NIFTI files first
    for (const folderName in filesByFolder) {
        const folderData = filesByFolder[folderName];
        
        // Add each NIFTI file to the combined array with metadata
        folderData.nifti.forEach(file => {
            allFiles.push({
                type: 'nifti',
                file: file,
                folder: folderName,
                displayName: file.name
            });
        });
    }
    
    // Then extract all DICOM series
    for (const folderName in filesByFolder) {
        const folderData = filesByFolder[folderName];
        
        // Only add if there are DICOM files in this folder
        if (folderData.dicom.length > 0) {
            let displayName = `DICOM Series (${folderData.dicom.length} files)`;
            
            // Use metadata if available
            if (folderMetadata[folderName]) {
                displayName = folderMetadata[folderName].displayName;
            }
            
            allFiles.push({
                type: 'dicom',
                files: folderData.dicom,
                folder: folderName,
                displayName: displayName,
                fileCount: folderData.dicom.length
            });
        }
    }
    
    // Sort all files alphanumerically by display name
    allFiles.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, {numeric: true}));
    
    // Check if we found any files
    filesFound = allFiles.length > 0;
    
    // Render the sorted files with sequential numbering
    allFiles.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'file-row';
        
        // Add the numbering column first
        const numberCell = document.createElement('td');
        numberCell.textContent = (index + 1).toString();
        numberCell.className = 'number-cell';
        row.appendChild(numberCell);
        
        // Add the filename/series cell
        const fileCell = document.createElement('td');
        fileCell.textContent = item.displayName;
        fileCell.title = `Click to load: ${item.displayName}`;
        fileCell.className = 'clickable-cell';
        fileCell.dataset.type = item.type;
        
        // File number is index + 1
        const fileNumber = index + 1;
        
        // Set up click handler based on file type
        if (item.type === 'nifti') {
            fileCell.onclick = function() {
                try {
                    const viewerIndex = prompt('Enter viewer panel number (1-4):', '1');
                    const panelNum = parseInt(viewerIndex);
                    
                    if (panelNum >= 1 && panelNum <= 4) {
                        console.log(`Loading NIFTI file #${fileNumber} into panel ${panelNum}`);
                        loadNiftiFile(panelNum - 1, item.file, fileNumber);
                    } else {
                        alert('Please enter a valid panel number (1-4)');
                    }
                } catch (err) {
                    console.error("Error during file loading:", err);
                    alert("There was an error loading the file. Please try again.");
                }
            };
        } else if (item.type === 'dicom') {
            fileCell.onclick = function() {
                try {
                    const viewerIndex = prompt('Enter viewer panel number (1-4):', '1');
                    const panelNum = parseInt(viewerIndex);
                    
                    if (panelNum >= 1 && panelNum <= 4) {
                        console.log(`Loading DICOM series #${fileNumber} into panel ${panelNum}`);
                        loadDicomFiles(panelNum - 1, [...item.files], fileNumber);
                    } else {
                        alert('Please enter a valid panel number (1-4)');
                    }
                } catch (err) {
                    console.error("Error during DICOM loading:", err);
                    alert("There was an error loading the DICOM series. Please try again.");
                }
            };
        }
        
        // Add cells to row
        row.appendChild(fileCell);
        tbody.appendChild(row);
    });
    
    // If no files found, show message
    if (!filesFound) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.textContent = 'No DICOM or NIFTI files found in directory';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        emptyCell.colSpan = 2; // Span across both columns
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    }

    // After all files are added, check for overflow and add scroll hint
    if (filesFound) {
        // Run after a small delay to ensure DOM is updated
        setTimeout(() => {
            checkTableOverflow(tbody);
        }, 100);
        
        // Also set up a mutation observer to monitor for content changes
        const observer = new MutationObserver(() => {
            checkTableOverflow(tbody);
        });
        
        observer.observe(tbody, { childList: true, subtree: true });
    }
}

// Check if table content overflows and show scrollbar accordingly
function checkTableOverflow(tbody) {
    if (!tbody) return;
    
    const scrollContainer = tbody.closest('.table-scroll-container');
    if (!scrollContainer) return;
    
    const table = scrollContainer.querySelector('table');
    if (!table) return;
    
    // Ensure the table takes full width of its content to measure true width
    table.style.width = 'auto';
    table.style.minWidth = '100%';
    
    // Force a reflow to get accurate measurements
    void scrollContainer.offsetWidth;
    
    // Check if any cell content is being cut off (more reliable comparison)
    const isOverflowing = Math.ceil(table.getBoundingClientRect().width) > Math.floor(scrollContainer.clientWidth);
    console.log(`Table overflow check: table=${table.getBoundingClientRect().width}px, container=${scrollContainer.clientWidth}px, overflow=${isOverflowing}`);
    
    // Always ensure scrollbar appears when content overflows
    scrollContainer.style.overflowX = 'auto';
    
    // Add overflow class for styling if needed
    if (isOverflowing) {
        scrollContainer.classList.add('has-overflow');
    } else {
        scrollContainer.classList.remove('has-overflow');
    }
    
    // Remove any existing hint - we don't want to show hints anymore
    const existingHint = scrollContainer.parentNode.querySelector('.scroll-hint');
    if (existingHint) {
        existingHint.remove();
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
    
    // Set up synchronization toggle - FIXED
    document.getElementById('toggle-sync').addEventListener('click', function() {
        syncEnabled = !syncEnabled;
        this.textContent = syncEnabled ? 'Disable Sync' : 'Enable Sync';
        
        // Important: Re-setup synchronization when toggled
        setupSynchronization();
        
        // Update UI feedback
        console.log(`Synchronization is now ${syncEnabled ? 'enabled' : 'disabled'}`);
        
        // Show alert without blocking the UI
        const alertDiv = document.createElement('div');
        alertDiv.textContent = `Synchronization is now ${syncEnabled ? 'enabled' : 'disabled'}`;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.left = '50%';
        alertDiv.style.transform = 'translateX(-50%)';
        alertDiv.style.padding = '10px 20px';
        alertDiv.style.background = '#333';
        alertDiv.style.color = '#fff';
        alertDiv.style.borderRadius = '5px';
        alertDiv.style.zIndex = '9999';
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 1s';
            setTimeout(() => document.body.removeChild(alertDiv), 1000);
        }, 2000);
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
    
    // Load directory button
    document.getElementById('load-directory').addEventListener('click', loadDirectoryImages);
    
    // Set up action buttons
    document.getElementById('action1').addEventListener('click', function() {
        console.log("Action 1 clicked");
        alert("Action 1 triggered");
    });
    
    document.getElementById('action2').addEventListener('click', function() {
        console.log("Action 2 clicked");
        alert("Action 2 triggered");
    });
    
    document.getElementById('action3').addEventListener('click', function() {
        console.log("Action 3 clicked");
        alert("Action 3 triggered");
    });
    
    document.getElementById('action4').addEventListener('click', function() {
        console.log("Action 4 clicked");
        alert("Action 4 triggered");
    });
    
    // Add window resize handler to check for table overflow
    window.addEventListener('resize', function() {
        const tbody = document.querySelector('.file-list-table tbody');
        if (tbody) {
            checkTableOverflow(tbody);
        }
    });
    
    // Add various events that should trigger overflow check
    window.addEventListener('resize', debounce(() => {
        const tbody = document.querySelector('.file-list-table tbody');
        if (tbody) {
            checkTableOverflow(tbody);
        }
    }, 100));

    // Add observer to monitor sidebar width changes
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar) {
        const resizeObserver = new ResizeObserver(debounce(() => {
            const tbody = document.querySelector('.file-list-table tbody');
            if (tbody) {
                checkTableOverflow(tbody);
            }
        }, 100));
        
        resizeObserver.observe(leftSidebar);
    }

    // Add a global error handler for Papaya
    window.addEventListener('error', function(event) {
        if (event.error && event.error.message && event.error.message.includes('Papaya')) {
            console.error('Papaya error caught:', event.error);
            alert('There was an error with the image viewer. Please try again.');
            
            // Remove any loading overlays
            document.querySelectorAll('.loading-overlay').forEach(element => {
                element.remove();
            });
            
            event.preventDefault();
        }
    });

    // Add specific handler for Papaya image loading failures
    window.addEventListener('papayaerror', function(event) {
        console.error('Papaya error event:', event);
        alert('There was an error loading the medical image. Please try a different file.');
        
        // Remove any loading overlays
        document.querySelectorAll('.loading-overlay').forEach(element => {
            element.remove();
        });
    });
});

// Simple debounce function to avoid excessive calls
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Enable verbose Papaya logging
papaya.debug = true;
})();
