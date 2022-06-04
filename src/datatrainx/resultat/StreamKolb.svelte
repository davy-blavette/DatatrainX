<script>
    import { onMount } from 'svelte';
    import {Chart, Decimation, registerables} from 'chart.js';
    import {userIdtStore} from "../../stores";
    import {dataStream, streamExpression} from "../../service-factory/data";
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
            data: dataStream,
            options: {
                responsive: true,
                animation: true,
                parsing: true,
                scales: {
                    x: {
                        type: "time",
                        ticks: {
                            source: 'auto',
                            // Disabled rotation for performance
                            maxRotation: 0,
                            autoSkip: true,
                        }
                    },
                    y: {
                        title: {
                            display: false,
                            text: "Value",
                        },
                    },
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                plugins: {
                    decimation: Decimation,
                    title: {
                        display: true,
                        text: `Données de streaming`
                    }
                }
            },
        });

    });

</script>

<style>
    canvas{
        max-height: 300px;
    }
</style>
<canvas bind:this={chartCanvas} id="myChart"></canvas>