<script>
    import { onMount } from 'svelte';
    import { Chart, registerables } from 'chart.js';
    import * as LuxonAdapter from "chartjs-adapter-luxon";

    import ChartStreaming from "chartjs-plugin-streaming";
    import {dataStream} from "../../service-factory/data";
    import {chartStore, videoStore} from "../../stores";

    Chart.register(...registerables);
    Chart.register(LuxonAdapter);
    Chart.register(ChartStreaming);

    let ctx;
    let chartCanvas;

    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');

        const onDestroy = (chart) => {
            Chart.destroy();
        };


        const dataChart = new Chart(ctx, {
            type: "line",
            data: dataStream,
            options: {
                scales: {
                    x: {
                        type: "realtime",
                        realtime: {
                            duration: 20000,
                            refresh: 1000,
                            delay: 2000,
                            //onRefresh: onRefresh,
                        },
                    },
                    y: {
                        title: {
                            display: false,
                            text: "Value",
                        },
                    },
                },
                interaction: {
                    intersect: false,
                },
            },
        });

        chartStore.set(dataChart);

    });



</script>
<style>
    #myChart{
        background-color: aliceblue;
        max-height: 300px;
    }
</style>
<canvas bind:this={chartCanvas} id="myChart"></canvas>