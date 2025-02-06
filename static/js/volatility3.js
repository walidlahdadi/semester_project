// Author : LAHDADI Walid

document.addEventListener("DOMContentLoaded", function () {
    const memoryDumpsList = document.getElementById("memory-dumps-list");
    const memoryDumpDetailsSection = document.getElementById("memory-dump-details");
    const selectMessage = document.getElementById("selectMessage");

    loadAnalysisResults();
    loadReports();

    const reportsList = document.getElementById("reports-list");
    reportsList.addEventListener("click", function (e) {
        const target = e.target;
        const reportItem = target.closest(".report-item");
        if (reportItem) {
            const dumpName = reportItem.getAttribute("data-dump-name");
            displayReportButtons(dumpName);
        }
    });

    
    memoryDumpsList.addEventListener("click", function (e) {
        if (e.target && (e.target.matches("li.memory-dump-item") || e.target.closest("li.memory-dump-item"))) {
            const memoryDumpItem = e.target.closest("li.memory-dump-item");
            const memoryDumpName = memoryDumpItem.getAttribute("data-name");
            const os = memoryDumpItem.getAttribute("data-os");
            const plugins = memoryDumpItem.getAttribute("data-plugins").split(",");

            selectMessage.style.display = "none";

            memoryDumpDetailsSection.innerHTML = `
                <h4>Memory Dump Details</h4>
                <p><strong>Name:</strong> ${memoryDumpName}</p>
                <p><strong>Operating System:</strong> ${os}</p>
                <h5>Plugins</h5>
                <ul class="list-group">
                    ${plugins
                        .map(plugin => {
                            if (plugin.endsWith(".json")) {
                                return `<li class="list-group-item">
                                    <a href="/plugins/${plugin}" target="_blank" class="plugin-link">${plugin}</a>
                                </li>`;
                            } else {
                                return `<li class="list-group-item clickable plugin-link" data-plugin="${plugin}" data-dump-name="${memoryDumpName}">${plugin}</li>`;
                            }
                        })
                        .join("")}
                </ul>
                <button id="analyzeButton" class="btn btn-primary mt-3">Analyze</button>
                <button id="deleteButton" class="btn btn-danger mt-3">Delete</button>
            `;

            document.getElementById("deleteButton").addEventListener("click", function () {
                const confirmDelete = confirm(
                    "Are you sure you want to delete this dump memory? " +
                    "This will also delete the analysis results, plugin results, and related reports."
                );

                if (confirmDelete) {
                    deleteDumpMemory(memoryDumpName);
                }
            });
        
            document.querySelectorAll(".list-group-item.clickable").forEach(pluginElement => {
                pluginElement.addEventListener("click", function () {
                    const pluginName = this.getAttribute("data-plugin");
                    const dumpName = this.getAttribute("data-dump-name");
                    fetchPluginResult(dumpName, pluginName);
                });
            });

            document.getElementById("analyzeButton").addEventListener("click", function () {
                startAnalysis(memoryDumpName, plugins);
            });
        }
    });


    function deleteDumpMemory(dumpName) {
        fetch(`/delete-dump-memory/${dumpName}`, {
            method: "DELETE",
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const elementsToRemove = document.querySelectorAll(`
                    li.memory-dump-item[data-name="${dumpName}"],
                    li.report-item[data-dump-name="${dumpName}"],
                    .analysis-result-item[data-dump-name="${dumpName}"],
                    [data-dump-name="${dumpName}"] .analysis-container,
                    .analysis-section[data-dump-name="${dumpName}"]
                `);
    
                elementsToRemove.forEach(item => {
                    console.log('Removing element:', item);
                    item.remove();
                });
    
                const storedResults = JSON.parse(localStorage.getItem('analysisResults') || '[]');
                const filteredResults = storedResults.filter(result => result.dumpName !== dumpName);
                localStorage.setItem('analysisResults', JSON.stringify(filteredResults));
    
                loadAnalysisResults();
                loadReports();
    
                const clearElements = [
                    document.getElementById("memory-dump-details"),
                    document.getElementById("report-link-container"),
                    document.querySelector(".active-analysis-view")
                ];
    
                clearElements.forEach(element => {
                    if (element) {
                        console.log('Clearing element:', element); 
                        element.innerHTML = '<p class="text-muted">Select an item to view details</p>';
                    }
                });
    
                alert("Dump memory and related analysis deleted successfully.");
                
                setTimeout(() => {
                    document.querySelectorAll(`[data-dump-name="${dumpName}"]`)
                        .forEach(item => item.remove());
                }, 50);
    
            } else {
                alert("Failed to delete dump memory: " + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error("Delete error:", error);
            alert(`Deletion failed: ${error.message}`);
        });
    }

    function loadAnalysisResults() {
        fetch("/get-analysis-results")
            .then(response => response.json())
            .then(data => {
                const analysisResultsList = document.getElementById("analysis-results-list");
                if (analysisResultsList) {
                    analysisResultsList.innerHTML = "";
    
                    const existingResults = new Set(); 
    
                    data.forEach(result => {
                        if (!existingResults.has(result.dumpName + result.resultType)) {
                            const resultItem = document.createElement("li");
                            resultItem.className = "list-group-item analysis-result-item";
                            resultItem.setAttribute("data-dump-name", result.dumpName);
                            resultItem.setAttribute("data-result-type", result.resultType);
                            resultItem.innerHTML = `
                                <strong>${result.dumpName}</strong>
                                <div>Analysis Results ${result.resultType}</div>
                            `;
    
                            resultItem.addEventListener("click", function () {
                                displayAnalysisResult(result.results);
                            });
    
                            analysisResultsList.appendChild(resultItem);
                            existingResults.add(result.dumpName + result.resultType);
                        }
                    });
                }
            })
            .catch(error => console.error("Error fetching analysis results:", error));
    }

    function loadReports() {
        fetch("/get_reports")
            .then(response => response.json())
            .then(reports => {
                console.log('Received reports:', reports);
                const reportsList = document.getElementById("reports-list");
                if (reportsList) {
                    reportsList.innerHTML = "";
                    reports.forEach(reportFilename => {
                        const dumpName = reportFilename.replace('report_', '').replace('.pdf', '');
                        const reportItem = document.createElement("li");
                        reportItem.className = "list-group-item report-item";
                        reportItem.setAttribute("data-dump-name", dumpName);
                        reportItem.innerHTML = `
                            <strong>${dumpName}</strong>
                            <div>${reportFilename}</div>
                        `;
                        reportItem.addEventListener("click", function () {
                            displayReportButtons(dumpName);
                        });
                        reportsList.appendChild(reportItem);
                    });
                }
            })
            .catch(error => console.error("Error fetching reports:", error));
    }

    

    function startAnalysis(name, plugins) {
        
        const analyzeBtn = document.getElementById("analyzeButton");
        analyzeBtn.disabled = true;
    
        
        const popup = document.createElement("div");
        popup.id = "popup";
        popup.innerHTML = `
            <div id="popupContent">
                <p id="pluginName">Running plugin: Initializing...</p>
                <div id="progressBarContainer">
                    <div id="progressBar"></div>
                </div>
                <p id="progressText">Progress: 0%</p>
            </div>
        `;
        document.body.appendChild(popup);
    
        const payload = { dumps: [{ dumpName: name, plugins: plugins }] };
        fetch("/start-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    let currentPluginIndex = 0;
    
                    const interval = setInterval(() => {
                        if (currentPluginIndex < plugins.length) {
                            const plugin = plugins[currentPluginIndex];
                            document.getElementById("pluginName").innerText = `Running plugin: ${plugin}`;
                            const progress = Math.floor(((currentPluginIndex + 1) / plugins.length) * 100);
                            document.getElementById("progressBar").style.width = `${progress}%`;
                            document.getElementById("progressText").innerText = `Progress: ${progress}%`;
    
                            currentPluginIndex++;
                        } else {
                            clearInterval(interval);
                            popup.remove(); 
                            analyzeBtn.disabled = false;
    
                            const existingItems = document.querySelectorAll(`.analysis-result-item[data-dump-name="${name}"]`);
                            existingItems.forEach(item => item.remove());
    
                            alert("Analysis completed successfully!");
    
                            waitForPluginsToFinish(name, plugins)
                                .then(() => fetchAndComparePIDs(name))
                                .catch(error => console.error("Error waiting for plugins:", error));
                        }
                    }, 3000); 
                } else {
                    alert("Failed to start analysis.");
                    popup.remove(); 
                    analyzeBtn.disabled = false; 
                }
            })
            .catch(err => {
                console.error("Error starting analysis:", err);
                alert("An error occurred while starting the analysis.");
                popup.remove(); 
                analyzeBtn.disabled = false; 
            });
    }

    function waitForPluginsToFinish(dumpName, plugins) {
        
        const pluginChecks = plugins.map(plugin => {
            return fetch(`/get_plugin_result/${dumpName}/${plugin}`)
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error(`Plugin ${plugin} result not found`);
                    }
                });
        });

       
        return Promise.all(pluginChecks);
    }

    function fetchAndComparePIDs(dumpName) {
        console.log("Fetching and comparing PIDs for:", dumpName); 

        fetch(`/get_plugin_result/${dumpName}/pslist`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch pslist results: ${response.statusText}`);
                }
                return response.json();
            })
            .then(pslistData => {
                console.log("pslistData:", pslistData); 

                fetch(`/get_plugin_result/${dumpName}/psscan`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to fetch psscan results: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(pscanData => {
                        console.log("pscanData:", pscanData); 

                        const pslistPIDs = pslistData.output.map(process => process.PID);
                        const pscanPIDs = pscanData.output.map(process => process.PID);

                        const missingPIDs = pslistPIDs.filter(pid => !pscanPIDs.includes(pid));
                        const missingProcesses = pslistData.output.filter(process => missingPIDs.includes(process.PID));

                        console.log("missingProcesses:", missingProcesses); 

                        // Store the comparison results in a JSON file
                        const comparisonResults = {
                            dumpName: dumpName,
                            missingProcesses: missingProcesses
                        };

                        fetch("/save-comparison-results", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(comparisonResults),
                        })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    console.log("Comparison results saved successfully."); 
                                    // Add the comparison results to the left panel
                                    addAnalysisResultToPanel(dumpName, "analysis_result_pslist_psscan", comparisonResults);
                                    addReportToPanel(dumpName);
                                } else {
                                    console.error("Failed to save comparison results."); 
                                }
                            });
                    })
                    .catch(error => console.error("Error fetching psscan results:", error));
            })
            .catch(error => console.error("Error fetching pslist results:", error));

    }


    function addAnalysisResultToPanel(dumpName, resultType, results) {
        console.log("Adding analysis result to panel:", dumpName, resultType, results);
    
        fetch("/save-analysis-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dumpName, resultType, results }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("Analysis results saved to server.");
                    
                    loadAnalysisResults(); 
                } else {
                    console.error("Failed to save analysis results to server.");
                }
            });
    
        // Generate report
        fetch(`/generate_report/${dumpName}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("Report generated successfully.");
                    loadReports();
                    
                    const reportLinkContainer = document.getElementById("report-link-container");
                    if (reportLinkContainer) {
                        reportLinkContainer.innerHTML = `
                            <a href="/download_report/${data.report_name}" class="report-download-link">
                                Download Report for ${dumpName}
                            </a>
                        `;
                    }
                } else {
                    console.error("Failed to generate report.");
                }
            });
    }

    

    function displayAnalysisResult(results) {
        const memoryDumpDetailsSection = document.getElementById("memory-dump-details");
        if (!memoryDumpDetailsSection) {
            console.error("memory-dump-details element not found!");
            return;
        }

        memoryDumpDetailsSection.innerHTML = "";

        const heading = document.createElement("h4");
        heading.textContent = "Analysis Results Pslist Psscan";
        memoryDumpDetailsSection.appendChild(heading);

        const dumpName = document.createElement("p");
        dumpName.innerHTML = `<strong>Dump Name:</strong> ${results.dumpName}`;
        memoryDumpDetailsSection.appendChild(dumpName);

        if (results.missingProcesses.length > 0) {
            const table = generateTable(results.missingProcesses);
            memoryDumpDetailsSection.innerHTML += table;
        } else {
            const message = document.createElement("p");
            message.textContent = "No missing PIDs found.";
            memoryDumpDetailsSection.appendChild(message);
        }
    }

    let currentDumpName = ""; 

function fetchPluginResult(dumpName, pluginName) {
    const url = `/get_plugin_result/${dumpName}/${pluginName}`;

    fetch(url)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("Plugin result not found");
            }
        })
        .then(data => {
            currentDumpName = dumpName;
            displayPluginPopup(pluginName, data.output);
        })
        .catch(error => {
            console.error("Error fetching plugin result:", error);
            alert("Click analyze to see plugin result.");
        });
}


function displayPluginPopup(pluginName, results) {
    const existingPopup = document.getElementById("pluginPopup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.id = "pluginPopup";
    popup.className = "popup";

    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";

    const title = document.createElement("h5");
    title.className = "popup-title";
    title.textContent = `Plugin: ${pluginName}`;

    const body = document.createElement("div");
    body.className = "popup-body";

    if (results && results.length > 0) {
        if (pluginName.toLowerCase() === 'pstree') {
            const treeContainer = generateTree(results);
            body.appendChild(treeContainer);
        } else {
            const processedResults = results.map(result => {
                if (result['Offset(V)']) {
                    // Convert the Offset(V) from decimal to hexadecimal
                    let decimalValue = parseInt(result['Offset(V)'], 10);
                    if (!isNaN(decimalValue)) {
                        result['Offset(V)'] = '0x' + decimalValue.toString(16).toUpperCase(); 
                    }
                }
                return result;
            });
            body.innerHTML = generateTable(processedResults);
        }
    } else {
        body.innerHTML = "<p>No results found.</p>";
    }

    const closeButton = document.createElement("button");
    closeButton.className = "btn btn-secondary close-popup-btn";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", function () {
        popup.remove();
    });

    popupContent.appendChild(title);
    popupContent.appendChild(body);
    popupContent.appendChild(closeButton);
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
}

// Generate the process tree from pstree plugin
function generateTree(processes) {
    const container = document.createElement('div');
    container.className = 'tree-container';

    processes.forEach(process => {
        const node = createTreeNode(process);
        container.appendChild(node);
    });

    return container;
}

// Create a tree node for each process
function createTreeNode(process) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    const header = document.createElement('div');
    header.className = 'tree-node-header';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tree-toggle';
    toggleBtn.textContent = process.__children && process.__children.length > 0 ? '+' : '';
    toggleBtn.addEventListener('click', function () {
        const children = node.querySelector('.tree-children');
        if (children) {
            children.classList.toggle('expanded');
            toggleBtn.textContent = children.classList.contains('expanded') ? '-' : '+';
        }
    });

    // Create a clickable link for the process name
    const clickableLink = document.createElement('a');
    clickableLink.textContent = `${process.ImageFileName} (PID: ${process.PID})`;
    clickableLink.href = "#";
    clickableLink.className = "process-link";
    clickableLink.addEventListener('click', function (event) {
        event.preventDefault();

        runPluginWithPid(currentDumpName, process.PID, process.ImageFileName || 'unknown_process');
    });

    header.appendChild(toggleBtn);
    header.appendChild(clickableLink);
    node.appendChild(header);

    if (process.__children && process.__children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        process.__children.forEach(child => {
            const childNode = createTreeNode(child);
            childrenContainer.appendChild(childNode);
        });
        node.appendChild(childrenContainer);
    }

    return node;
}

// Run the plugin with the selected dump name, PID, and process name
function runPluginWithPid(dumpName, pid, processName) {
    if (!dumpName || !pid || !processName) {
        alert('Missing parameters for plugin execution');
        return;
    }

    const encodedProcessName = encodeURIComponent(processName);
    const url = `/run_plugin/${dumpName}/${pid}/${encodedProcessName}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`Memmap results saved to:\n${data.outputPath}`);
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .catch(error => {
            console.error("Error running plugin:", error);
            alert("Failed to run plugin. See console for details.");
        });
}

    function generateTable(data) {
        const headers = Object.keys(data[0]);
        const table = `
            <table class="table table-bordered table-striped">
                <thead>
                    <tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr>
                </thead>
                <tbody>
                    ${data.map(row => `<tr>${headers.map(header => `<td>${row[header] || ""}</td>`).join("")}</tr>`).join("")}
                </tbody>
            </table>
        `;
        return table;
    }

    function addReportToPanel(dumpName) {
        const reportFilename = `report_${dumpName}.pdf`;
        const reportItem = document.createElement("li");
        reportItem.className = "list-group-item report-item";
        reportItem.setAttribute("data-dump-name", dumpName);
        reportItem.innerHTML = `
            <strong>${dumpName}</strong>
            <div>Report: ${reportFilename}</div>
        `;
    
        reportItem.addEventListener("click", function () {
            displayReportButtons(dumpName);
        });
    
        const reportsList = document.getElementById("reports-list");
        if (reportsList) {
            reportsList.appendChild(reportItem);
        }
    }

    function displayReportButtons(dumpName) {
        const memoryDumpDetailsSection = document.getElementById("memory-dump-details");
        if (!memoryDumpDetailsSection) {
            console.error("memory-dump-details element not found!");
            return;
        }
    
        memoryDumpDetailsSection.innerHTML = "";
    
        memoryDumpDetailsSection.innerHTML = `
            <h4>Report Details</h4>
            <p><strong>Dump Name:</strong> ${dumpName}</p>
            <p><strong>Report File:</strong> report_${dumpName}.pdf</p>
            <div class="mt-3">
                <a href="/view_report/report_${dumpName}.pdf" target="_blank" class="btn btn-primary mr-2">View Report</a>
                <a href="/download_report/report_${dumpName}.pdf" class="btn btn-secondary">Download Report</a>
            </div>
        `;
    }
});


document.addEventListener("DOMContentLoaded", function () {
    const addDumpBtn = document.getElementById("addDumpBtn");
    const pluginsBtn = document.getElementById("pluginsBtn");
    const addDumpForm = document.getElementById("addDumpForm");
    const pluginsSelection = document.getElementById("pluginsSelection");
    const finishAddDump = document.getElementById("finishAddDump");
    const savePlugins = document.getElementById("savePlugins");

    const pluginList = document.querySelectorAll("#pluginList input");
    const pluginListPlugins = document.querySelectorAll("#pluginListPlugins input");

    addDumpBtn.addEventListener("click", () => {
        addDumpForm.classList.toggle("d-none");
    });

    pluginsBtn.addEventListener("click", () => {
        pluginsSelection.classList.toggle("d-none");
        pluginListPlugins.forEach((plugin, index) => {
            plugin.checked = pluginList[index].checked;
        });
    });

    savePlugins.addEventListener("click", () => {
        pluginListPlugins.forEach((plugin, index) => {
            pluginList[index].checked = plugin.checked;
        });
        pluginsSelection.classList.add("d-none");
        alert("Plugins updated successfully!");
    });

    finishAddDump.addEventListener("click", () => {
        addDumpForm.classList.add("d-none");
        alert("Memory dump and plugins selected successfully!");
    });
});
