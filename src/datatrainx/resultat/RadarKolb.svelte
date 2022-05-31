<script>
    import { onMount } from 'svelte';
    import {Chart, registerables} from 'chart.js';
    Chart.register(...registerables);


    let chartData;
    let chartLabels = ['Concret', 'Analytique', 'Abstrait', 'Proactif'];
    let ctx;
    let chartCanvas;

    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Profil d\'apprenant',
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgb(255, 99, 132)',
                        data: [20, 18, 15, 11],
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Chart.js Radar Chart'
                    }
                },
                scale: {
                    scale: {
                        min: 0,
                        max: 20,
                    }
                }
            },

        });

    });

</script>

<style>

</style>
<canvas bind:this={chartCanvas} id="myChart"></canvas>