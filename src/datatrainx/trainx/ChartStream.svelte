<script>
    import { onMount } from 'svelte';
    import { Chart, registerables } from 'chart.js';
    import * as LuxonAdapter from "chartjs-adapter-luxon";

    import ChartStreaming from "chartjs-plugin-streaming";
    import {dataExpression} from "../../config";

    Chart.register(...registerables);
    Chart.register(LuxonAdapter);
    Chart.register(ChartStreaming);

    let ctx;
    let chartCanvas;



    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');

        let _seed = Date.now();


        const rand = (min, max) => {
            return Math.floor(Math.random() * (max - min + 1)) + min
        };

        const onRefresh = (chart) => {
            const now = Date.now();
            chart.data.datasets.forEach((dataset) => {
                dataset.data.push({
                    x: now,
                    y: rand(-100, 100),
                });
            });
        };

        const data = {
            datasets: [
                {
                    label: "Colère",
                    backgroundColor: "#FF6B6B",
                    borderColor: "#FF6B6B",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.colere,
                },
                {
                    label: "Dégoût",
                    backgroundColor: "#FFD93D",
                    borderColor: "#FFD93D",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.degout,
                },
                {
                    label: "Peur",
                    backgroundColor: "#6BCB77",
                    borderColor: "#6BCB77",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.peur,
                },
                {
                    label: "Joie",
                    backgroundColor: "#4D96FF",
                    borderColor: "#4D96FF",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.joie,
                },
                {
                    label: "Triste",
                    backgroundColor: "#AB46D2",
                    borderColor: "#AB46D2",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.triste,
                },
                {
                    label: "Surprise",
                    backgroundColor: "#FF6FB5",
                    borderColor: "#FF6FB5",
                    cubicInterpolationMode: "monotone",
                    data: dataExpression.surprise,
                }
            ],
        };

        const chart = new Chart(ctx, {
            type: "line",
            data: data,
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
    });

</script>
<style>
    #myChart{
        background-color: aliceblue;
        max-height: 300px;
    }
</style>
<canvas bind:this={chartCanvas} id="myChart"></canvas>