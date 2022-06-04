<script>
    export let image;
    export let best;
    export let label;
    export let bg;
    export let intensity;
</script>
<style>
    figure, img {
        max-height: 250px;
    }
    article.tile.is-child{
        margin: 1em!important;
    }
    .has-background-triste{
        background-color: #AB46D2;
    }
    .has-background-surprise{
        background-color: #FF6FB5;
    }
</style>
<article class="tile {bg} is-child box">
    <figure class="image">
        <img src={image} alt="Joie {best * 100} %">
    </figure>
    <p class="title has-text-white">{label} </p>
    <p class="subtitle has-text-white">Intensité {intensity} %</p>
    <hr>
    <p class="subtitle has-text-white">Panel {intensity} %</p>
</article>