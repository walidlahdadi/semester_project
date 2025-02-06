// Author : LAHDADI Walid
document.addEventListener("DOMContentLoaded", function () {
    fetch("/get_chart_data")
        .then((response) => response.json())
        .then((data) => {
            // Memory Chart
            new Chart(document.getElementById("memoryChart"), {
                type: "bar",
                data: {
                    labels: data.memory.labels,
                    datasets: [{
                        label: "Memory Usage",
                        data: data.memory.values,
                        backgroundColor: "rgba(54, 162, 235, 0.2)",
                        borderColor: "rgba(54, 162, 235, 1)",
                        borderWidth: 1,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: "Memory Analysis" },
                    },
                },
            });

            //  Disk Chart
            new Chart(document.getElementById("diskChart"), {
                type: "bar",
                data: {
                    labels: data.disk.labels,
                    datasets: [{
                        label: "Disk Usage",
                        data: data.disk.values,
                        backgroundColor: "rgba(75, 192, 192, 0.2)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: "Disk Analysis" },
                    },
                },
            });

            // Network Chart
            new Chart(document.getElementById("networkChart"), {
                type: "bar",
                data: {
                    labels: data.network.labels,
                    datasets: [{
                        label: "Network Usage",
                        data: data.network.values,
                        backgroundColor: "rgba(255, 99, 132, 0.2)",
                        borderColor: "rgba(255, 99, 132, 1)",
                        borderWidth: 1,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: "Network Analysis" },
                    },
                },
            });
        })
        .catch((error) => console.error("Error fetching chart data:", error));
});
