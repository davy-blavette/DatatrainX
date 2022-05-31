import {writable} from 'svelte/store';
import {dataExpression} from "./database/data";

export const cnnStore = writable([]);
export const svgStore = writable(undefined);

export const vSpaceAroundGapStore = writable(undefined);
export const hSpaceAroundGapStore = writable(undefined);

export const nodeCoordinateStore = writable([]);
export const selectedScaleLevelStore = writable(undefined);

export const cnnLayerRangesStore = writable({});
export const cnnLayerMinMaxStore = writable([]);

export const needRedrawStore = writable([undefined, undefined]);

export const detailedModeStore = writable(true);

export const shouldIntermediateAnimateStore = writable(false);

export const isInSoftmaxStore = writable(false);
export const softmaxDetailViewStore = writable({});
export const allowsSoftmaxAnimationStore = writable(false);

export const hoverInfoStore = writable({});

export const modalStore = writable({});

export const intermediateLayerPositionStore = writable({});

export const leftStartStore = writable(0);
export const kolbStore = writable(0);
export const fpsStore = writable("0 ms");
export const timeStore = writable("0 fps");
export const videoStore = writable(false);
export const loadingStore = writable(false);
export const chartStore = writable({});
export const titleTestStore = writable("Test de Kolb");
export const userIdtStore = writable("");
export const infoLoadStore = writable("");
export const dataExpressionStore= writable([]);

function createLayout() {
    const { subscribe, set } = writable("presentation");
    return {
        subscribe,
        setLayout: (view) => set(view)
    };
}

export const layoutStore = createLayout();
export const layoutTrainxStore = createLayout();