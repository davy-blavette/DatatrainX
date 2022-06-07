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
        Reflector, veulent beaucoup de pauses pour lire et discuter. Ils apprennent mieux des activités où;
    </h2>
    <hr>
    <div class="columns">
        <div class="column is-three-quarters">
            <ul>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a des opportunités à observer et à considérer
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a un fort élément d'implication passive comme écouter un orateur ou regarder un
                    vidéo
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a du temps pour réfléchir avant d'avoir à agir ou à contribuer
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a possibilité de recherche et les problèmes peuvent être approfondis
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils peuvent passer en revue ce qui se passait
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    La pertinence est évidente et l'apprentissage est facilement transférable à leur travail
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il leur est demandé de produire des rapports qui analysent attentivement une situation ou un problème
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il y a interaction avec les autres sans aucun risque de sentiments forts venant au premier plan
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils peuvent finaliser une vue sans être mis sous pression.
                </li>
            </ul>
        </div>
        <Score score="{score}"/>
    </div>
    <hr>
</div>