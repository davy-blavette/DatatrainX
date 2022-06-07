<script>
    import { onMount } from 'svelte';
    import {Chart, registerables} from 'chart.js';
    import {chartLabels} from "../../service-factory/data";
    Chart.register(...registerables);

    export let profil;
    export let total;

    let ctx;
    let chartCanvas;



    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ["Expressions émises"],
                datasets: [
                    {
                        label: 'Votre profil',
                        data: [total],
                        backgroundColor: 'rgba(241, 70, 104, 0.5)',
                        borderColor: 'rgb(241, 70, 104)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: `Panel ${profil}`,
                        data: [35],
                        backgroundColor: 'rgba(72, 199, 116, 0.5)',
                        borderColor: 'rgba(72, 199, 116)',
                        fill: true
                    },
                    {
                        label: 'Ensemble',
                        data: [42],
                        backgroundColor: 'rgba(50, 152, 220, 0.5)',
                        borderColor: 'rgb(50, 152, 220)',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: true,
                    title: {
                        display: true,
                        text: `Force des expressions`
                    }
                }
            }
        });

    });


</script>

<style>
    #barExpression{
        max-height: 320px;
    }
</style>
<canvas bind:this={chartCanvas} id="barExpression"></canvas>