<script>
    import {onMount} from 'svelte';
    import {Chart, Decimation, registerables} from 'chart.js';
    import {infoLoadStore} from "../../stores";
    import {baseUrl, dataStream, streamExpression} from "../../service-factory/data";
    import Loading from "../utils/Loading.svelte";

    Chart.register(...registerables);
    export let userId;

    let ctx;
    let chartCanvas;
    let jsonTrainer = [];
    let data;
    streamExpression.colere.length = 0;
    streamExpression.degout.length = 0;
    streamExpression.peur.length = 0;
    streamExpression.joie.length = 0;
    streamExpression.triste.length = 0;
    streamExpression.surprise.length = 0;

    infoLoadStore.set("Chargement Resultats...");

    onMount(async (promise) => {
        let res = await fetch(`${baseUrl}/dataProfil/stream/${userId}`);
        jsonTrainer = [await res.json()];
        data = Object.values(jsonTrainer)[0].dataExpression;
        data.forEach(function (expressions) {
            for (const [expression, value] of Object.entries(expressions.FaceExpression)) {
                for (const [expressionLabel, valueData] of Object.entries(streamExpression)) {
                    if (expression ==expressionLabel && value > 0) {
                        streamExpression[expressionLabel].push({
                            x: expressions.created,
                            y: value,
                        });
                    }
                }
            }
        });
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
{#if jsonTrainer.length === 0}
    <Loading />
{/if}
    <canvas bind:this={chartCanvas} id="myChart"></canvas>
