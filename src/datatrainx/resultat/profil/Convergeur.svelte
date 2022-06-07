<script>
    import Pragmatist from "./Pragmatist.svelte";
    import Therorist from "./Therorist.svelte";
    export let theorist;
    export let pragmatist;
</script>
<div class="">
    <p>Les apprenants qui ont une préférence pour ce style d’apprentissage vont trouver important de questionner l’application des apprentissages dans leur contexte de travail. C’est en mettant en pratique les connaissances et les habiletés qu’ils vont réellement les intégrer. Leur apprentissage est favorisé durant les phases d’expérimentation active et de conceptualisation abstraite. Préférant travailler seul, un convergeur va avoir une bonne capacité à résoudre les problèmes rencontrés et à identifier les solutions appropriées. Ses forces proviennent de sa capacité à dégager les implications concrètes et spécifiques de principes plus abstraits. Cette capacité de déduction de la théorie à la pratique le rend utile pour contribuer au transfert des apprentissages.</p>
    <p class="subtitle">Implications pour la formation en organisation :</p>
    <p>Pour répondre à ce style d’apprentissage, une formation doit permettre la résolution de problèmes concrets. À ce titre, elle doit inclure des activités guidées par la pratique, telles des démonstrations, des études de cas et la gestion de projets.</p>
    <hr>
    <Therorist
            score={theorist}
    />
    <Pragmatist
            score={pragmatist}
    />
</div>