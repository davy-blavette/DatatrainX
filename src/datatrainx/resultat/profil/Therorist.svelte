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
        Theorist, veulent des documents, quelque chose à emporter et à étudier. Ils apprennent mieux des activités
        où :
    </h2>
    <hr>
    <div class="columns">
        <div class="column is-three-quarters">
            <ul>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    L'apprentissage fait partie d'un ensemble conceptuel, tel qu'un modèle pour une théorie
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a du temps pour explorer l'interrelation entre les éléments
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils peuvent explorer la théorie et la méthodologie sous-jacentes au sujet à l'étude
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils sont intellectuellement étirés
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a un but clair et évident aux activités
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a un recours à la rationalité et à la logique
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils peuvent analyser des situations puis généraliser leurs conclusions
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il leur est demandé de comprendre des situations complexes
                </li>
            </ul>
        </div>
        <Score score="{score}"/>
    </div>
    <hr>
</div>