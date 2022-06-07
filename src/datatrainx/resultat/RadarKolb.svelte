<script>
    import {onMount} from 'svelte';
    import {Chart, registerables} from 'chart.js';
    import {chartLabels} from "../../service-factory/data";

    Chart.register(...registerables);


    export let data;
    export let userId;

    let chartData;

    let ctx;
    let chartCanvas;
    let dataTab = [];

    for (const [profil, value] of Object.entries(data)) {
        dataTab.push(value.scoreRacine);
    }

    onMount(async (promise) => {
        ctx = chartCanvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Profil',
                        backgroundColor: 'rgba(241, 70, 104, 0.5)',
                        borderColor: 'rgb(241, 70, 104)',
                        data: dataTab,
                        fill: true
                    }
                ]
            },
            options: {

                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false,
                        text: `User : ${userId}`
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
    #radarKolb{
        position: relative;
        z-index: 95;
        max-height: 320px;
    }
.conteneur{
    position:relative;
    width: 100%;
}
.legends{
    position:absolute;
    top: 0px;
    height: 100%;
    width: 100%;
    z-index: 1;
}
.legends p {
    padding: 0.75rem;
    color: black;
    text-align: center;
    font-weight: bold;
    width: 9em;
}
.adaptateur{
    top: 25%;
    left: 15%;
    position: absolute;
}
.divergeur{
    top: 25%;
    right: 15%;
    position: absolute;
}
.assimilateur{
    bottom: 25%;
    right: 15%;
    position: absolute;
}
.convergeur{
    bottom: 25%;
    left: 15%;
    position: absolute;
}
</style>
<div class="conteneur">
    <canvas bind:this={chartCanvas} id="radarKolb"></canvas>
    <div class="legends">
        <p class="adaptateur">ADAPTATEUR</p>
        <p class="divergeur">DIVERGEUR</p>
        <p class="assimilateur">ASSIMILATEUR</p>
        <p class="convergeur">CONVERGEUR</p>
    </div>
</div>
