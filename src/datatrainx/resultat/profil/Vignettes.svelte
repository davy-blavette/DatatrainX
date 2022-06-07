<script>
    export let resultatExpressions;
    export let profil;
</script>
<style>
    figure, img {
        height: 200px;
        display: initial;
        width: auto;
    }
    article.tile.is-child{
        margin: 1em!important;
    }
    .subtitle{
        margin: 0;
    }
    .column{
        margin: 0.5em!important;
    }
</style>

<div class="columns tile">
    {#each Object.entries(resultatExpressions) as [type, expression]}
        {#if expression.count}
            <div class="column tile is-child box" style="background-color: {expression.utils.color}">
                <figure class="image">
                    <img src={expression.image} alt="{expression.utils.label} {expression.best * 100} %">
                </figure>
                <p class="title has-text-white">{expression.utils.label} </p>
                <p class="subtitle has-text-white">Intensité {Math.round(expression.total / expression.count * 100)} %</p>
                <hr>
                <p class="has-text-white">{profil.slice(0, 15)} </p>
                <p class="subtitle has-text-white">{Math.round(expression.total / expression.count * 100)} %</p>
                <p class="subtitle has-text-white">Ensemble {Math.round(expression.total / expression.count * 100)} %</p>
            </div>
        {/if}
    {/each}
</div>



