// Author : LAHDADI Walid

// Start Analysis Button Logic
document.querySelector(".btn-success").addEventListener("click", startAnalysis);

function startAnalysis() {
    const selectedDumps = Array.from(document.querySelectorAll(".memory-dump-checkbox:checked"));
    if (selectedDumps.length === 0) {
        alert("Please select at least one memory dump for analysis.");
        return;
    }

    const analysisProgress = document.getElementById("analysis-progress");
    analysisProgress.innerHTML = ""; 

    selectedDumps.forEach((dump, index) => {
        const progressItem = document.createElement("div");
        progressItem.className = "mb-3";
        progressItem.innerHTML = `
            <strong>${dump.id}</strong>
            <div class="progress">
                <div class="progress-bar" role="progressbar" style="width: 0%;" id="progress-bar-${index}">
                    0%
                </div>
            </div>
        `;
        analysisProgress.appendChild(progressItem);
        simulateProgress(`progress-bar-${index}`, dump.id);
    });
}

function simulateProgress(progressBarId, dumpName) {
    const progressBar = document.getElementById(progressBarId);
    let progress = 0;

    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${progress}%`;
    }, 1000); 
}


document.addEventListener("DOMContentLoaded", function () {
    const addMemoryDumpButton = document.getElementById("addMemoryDumpButton");
    const osSelect = document.getElementById("osSelect");
    const profileField = document.getElementById("profileField");

    addMemoryDumpButton.addEventListener("click", function () {
        $("#addMemoryDumpModal").modal("show");
    });

    osSelect.addEventListener("change", function () {
        if (osSelect.value === "windows") {
            profileField.style.display = "none";
        } else {
            profileField.style.display = "block";
        }
    });
});

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.style.display = section.style.display === "none" || section.style.display === "" ? "block" : "none";
}

function addPlugin(pluginName, dumpName) {
    const memoryDumpItems = document.querySelectorAll(".list-group-item");
    const targetDump = Array.from(memoryDumpItems).find(item =>
        item.textContent.includes(dumpName)
    );

    if (targetDump) {
        const pluginsList = targetDump.querySelector(".plugins-list");
        const newPlugin = document.createElement("li");
        newPlugin.className = "list-group-item";
        newPlugin.textContent = pluginName;
        pluginsList.appendChild(newPlugin);
    } else {
        alert("Memory dump not found!");
    }
}

