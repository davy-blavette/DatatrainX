<script>
    import { onMount } from 'svelte';
    import {Chart, registerables} from 'chart.js';
    import {userIdtStore} from "../../stores";
    Chart.register(...registerables);
    let userId = "";

    userIdtStore.subscribe(value => {
        userId = value;
    });
    let chartData;
    let chartValues = [20, 10, 5, 2, 20, 30, 45];
    let chartLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
    let ctx;
    let chartCanvas;


    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Revenue',
                    backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: chartValues
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `User : ${userId}`
                    }
                }
            },
        });

    });

</script>

<style>

</style>
<canvas bind:this={chartCanvas} id="myChart"></canvas>