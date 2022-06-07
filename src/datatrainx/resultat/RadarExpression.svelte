<script>
    import {onMount} from 'svelte';
    import {Chart, registerables} from 'chart.js';
    import {expressionLabels, resultatExpressions} from "../../service-factory/data";

    Chart.register(...registerables);

    export let expressions;
    export let profil;
    let chartData;
    let userChart = [];
    let profilChart = [10,5,8,65,10,2];
    let panelChart = [15,2,3,47,30,3];

    let ctx;
    let chartCanvas;

    for (const [expression, value] of Object.entries(expressions)) {
        userChart.push(value.ratio);
    };

    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: expressionLabels,
                datasets: [
                    {
                        label: 'Votre profil',
                        backgroundColor: 'rgba(241, 70, 104, 0.5)',
                        borderColor: 'rgb(241, 70, 104)',
                        data: userChart,
                        fill: true
                    },
                    {
                        label: `Panel ${profil} (4)`,
                        backgroundColor: 'rgba(72, 199, 116, 0.5)',
                        borderColor: 'rgba(72, 199, 116)',
                        data: profilChart,
                        fill: true
                    },
                    {
                        label: `Ensemble (6)`,
                        backgroundColor: 'rgba(50, 152, 220, 0.5)',
                        borderColor: 'rgb(50, 152, 220)',
                        data: panelChart,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: `Panel d'expression`
                    }
                }
            },

        });
    });

</script>

<style>
    #radarExpression{
        max-height: 320px;
    }
</style>
<div class="tile">
    <canvas bind:this={chartCanvas} id="radarExpression"></canvas>
</div>
