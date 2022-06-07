<script>
    import Score from "./score/Score.svelte";
    export let score;
</script>
<style>
    .fa-xs {
        height: 10px;
    }
</style>
<div class="category">
    <h2 class="title is-4">
        L'adaptateur
    </h2>
    <h3 class="title is-5">
        Actions orientées vers la mobilisation et l’animation des collectivités
    </h3>
    <hr>
    <div class="columns">
        <div class="column is-three-quarters">
            <ul>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Bonnes habiletés à l’application et à l’action.
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Prédisposition à agir rapidement et à prendre des risques.
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Résolution intuitive des problèmes.
                </li>
            </ul>
        </div>
        <Score score="{score}"/>
    </div>
    <hr>
</div>
