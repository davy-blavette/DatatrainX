<script>
    import { onMount } from 'svelte';
    import {Chart, registerables} from 'chart.js';
    import {chartLabels, dataProfil} from "../../service-factory/data";
    Chart.register(...registerables);

    export let data;
    export let userId;

    let ctx;
    let chartCanvas;
    let dataTab = [];

    for (const [profil, value] of Object.entries(data)) {
        dataTab.push(value.tab);
    }


    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Force du profil',
                        data: dataTab,
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
                        text: `User : ${userId}`
                    }
                },
                elements: {
                    bar: {
                        backgroundColor: colorize(),
                        borderColor: colorize(),
                        borderWidth: 2
                    }
                },
                scale: {
                    scale: {
                        min: -100,
                        max: 100,
                    }
                }
            }
        });

    });

    function colorize() {
        return (ctx) => {
            const v = ctx.parsed.y;
            const c = v < -40 ? '#f14668'
                : v < -20 ? '#ffdd57'
                    : v < 40 ? '#3298dc'
                        : v < 80 ? '#00d1b2'
                            : '#48c774';

            return c;
        };
    }

</script>

<style>
    #barKolb{
        max-height: 320px;
    }
</style>
<canvas bind:this={chartCanvas} id="barKolb"></canvas>