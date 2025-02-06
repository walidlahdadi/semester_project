// Author : LAHDADI Walid

function checkDefaultPlugins() {
    const defaultPlugins = ['PsList', 'PsScan', 'PsTree'];
    document.querySelectorAll('.form-check-input').forEach(input => {
        if (defaultPlugins.includes(input.value)) {
            input.checked = true; 
        }
    });
}

// Function to toggle the profile field visibility
function toggleProfileField() {
    const os = document.getElementById("osSelect").value;
    const profileField = document.getElementById("profileField");
    profileField.classList.toggle("hidden", os !== "linux"); 
}

document.getElementById("osSelect").addEventListener("change", toggleProfileField);

document.getElementById("addMemoryDumpModal").addEventListener("show.bs.modal", function () {
    const osSelect = document.getElementById("osSelect");
    osSelect.value = "windows"; 
    
    checkDefaultPlugins();
    toggleProfileField(); 

    document.getElementById("memoryDumpFile").value = "";
    document.getElementById("profileFile").value = "";
});

function submitMemoryDump() {
    const memoryDumpFileInput = document.getElementById("memoryDumpFile");
    const memoryDumpFile = memoryDumpFileInput.files[0];
    const os = document.getElementById("osSelect").value;
    const profileFileInput = document.getElementById("profileFile");
    const profileFile = profileFileInput.files[0];
    const selectedPlugins = Array.from(document.querySelectorAll('.form-check-input:checked'))
        .map(plugin => plugin.value);

    if (!memoryDumpFile) {
        alert("Please select a memory dump file before finishing.");
        return false;
    }

    if (os === "linux" && !profileFile) {
        alert("Please select a profile file for Linux.");
        return false;
    }

    const formData = new FormData();
    formData.append("memoryDumpFile", memoryDumpFile);
    formData.append("os", os);
    formData.append("plugins", JSON.stringify(selectedPlugins));

    if (os === "linux" && profileFile) {
        formData.append("profileFile", profileFile);
    }

    fetch('/upload_memory_dump', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Memory dump uploaded successfully!");
            addMemoryDump(data.dumpName, selectedPlugins, os);
        } else {
            alert("Failed to upload memory dump: " + data.message);
        }
    })
    .catch(err => console.error("Error uploading memory dump:", err));

    memoryDumpFileInput.value = "";
    if (profileFileInput) profileFileInput.value = "";
    document.querySelectorAll('.form-check-input').forEach(input => input.checked = false);
    $('#addMemoryDumpModal').modal('hide');

    return false;
}

document.addEventListener("DOMContentLoaded", function () {
    fetch('/get_uploaded_dumps')
        .then(response => response.json())
        .then(data => {
            const memoryDumpsList = document.getElementById("memory-dumps-list");
            data.dumps.forEach(dump => {
                addMemoryDump(dump.name, dump.plugins, dump.os);
            });
        })
        .catch(err => console.error("Error fetching uploaded dumps:", err));
});


function addMemoryDump(dumpName, plugins = [], os = "linux") {
    const memoryDumpsList = document.getElementById("memory-dumps-list");
    const memoryDumpItem = document.createElement("li");
    memoryDumpItem.className = "list-group-item memory-dump-item";
    memoryDumpItem.setAttribute("data-name", dumpName);
    memoryDumpItem.setAttribute("data-os", os);
    memoryDumpItem.setAttribute("data-plugins", plugins.join(","));

    memoryDumpItem.innerHTML = `
        <div>
            <span class="font-weight-bold">${dumpName}</span>
            <button class="btn btn-sm btn-link float-right toggle-collapse">+</button>
        </div>
        <ul class="list-group list-group-flush plugins-list mt-2" style="display: none;">
            ${plugins.map(plugin => `<li class="list-group-item">${plugin}</li>`).join("")}
        </ul>
    `;

    memoryDumpsList.appendChild(memoryDumpItem);
    const toggleButton = memoryDumpItem.querySelector(".toggle-collapse");
    const pluginsList = memoryDumpItem.querySelector(".plugins-list");
    toggleButton.addEventListener("click", () => {
        pluginsList.style.display = pluginsList.style.display === "none" ? "block" : "none";
        toggleButton.textContent = toggleButton.textContent === "+" ? "-" : "+";
    });
}


