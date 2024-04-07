<template>
    <div class="split-screen-container">
        <div class="base-map-container" v-show="isMapsVisible">
            <div class="base-map" id="base-map-left"></div>
            <div class="base-map" id="base-map-right"></div>
            <div class="draw">
                <div class="button-draw" @click="isDrawing ? stopDrawing() : startDrawing()">
                <!-- 绘图按钮 -->
                <a-tooltip placement="left">
                    <template #title>{{ isDrawing ? '停止绘图' : '开始绘图' }}</template>
                    <EditOutlined />
                </a-tooltip>
            </div>
            <div class="button-draw" @click="rotateMapsSync(Math.PI / 6)">
                <!-- 旋转按钮 -->
                <a-tooltip placement="left">
                    <template #title>顺时针30°</template>
                    <RedoOutlined />
                </a-tooltip>
            </div>
            <div class="button-draw" @click="rotateMapsSync(-Math.PI / 6)">
                <!-- 旋转按钮 -->
                <a-tooltip placement="left">
                    <template #title>逆时针30°</template>
                    <UndoOutlined />
                </a-tooltip>
            </div>
            </div>
            
        </div>
        <!-- 分屏按钮 -->
        <div class="position">
            <div @click="toggleMapsVisibility">
                <a-tooltip placement="left">
                    <template #title>分屏</template>
                    <LayoutFilled />
                </a-tooltip>
            </div>
        </div>
    </div>
</template>

<script setup>
import { LayoutFilled, EditOutlined, RedoOutlined, UndoOutlined } from '@ant-design/icons-vue';
import 'ant-design-vue/dist/reset.css'
import { onMounted, ref } from 'vue';
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import { defaults as defaultControls } from 'ol/control';
import { TileArcGISRest } from 'ol/source';
import axios from 'axios';
import { nextTick } from 'vue';
import Draw from 'ol/interaction/Draw';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';

const urls = ref({});
// 控制地图容器的可见性
const isMapsVisible = ref(false);
const mapLeft = ref(null);
const mapRight = ref(null);

// 图层对象
const vectorLayer = ref(null);
const rasterLayer = ref(null);
const markLayer1 = ref(null);
const markLayer2 = ref(null);

// arcgis地图服务图层
const arcgisLayer = ref(null);

const syncMapViews = (sourceMap, targetMap) => {
    // 检查是否已在同步过程中以避免无限循环
    if (sourceMap.isSyncing || targetMap.isSyncing) {
        return;
    }

    targetMap.isSyncing = true; // 设置同步标志

    const view = sourceMap.getView();
    const newCenter = view.getCenter();
    const newZoom = view.getZoom();

    // 更新另一个地图的视图
    targetMap.getView().setCenter(newCenter);
    targetMap.getView().setZoom(newZoom);

    targetMap.isSyncing = false; // 重置同步标志
};



const initMaps = () => {
    // 矢量图层
    const vectorSource = new XYZ({
        url: urls.value.vectorSourceURL,
        crossOrigin: 'anonymous'
    });
    vectorLayer.value = new TileLayer({
        title: '矢量图',
        source: vectorSource
    });

    // 影像图层
    const rasterSource = new XYZ({
        url: urls.value.rasterSourceURL,
        crossOrigin: 'anonymous'
    });
    rasterLayer.value = new TileLayer({
        title: '影像图',
        source: rasterSource
    });

    // 标注图层1
    const markSource1 = new XYZ({
        url: urls.value.markSource1URL,
        crossOrigin: 'anonymous'
    });
    markLayer1.value = new TileLayer({
        title: '标注图层1',
        source: markSource1
    });
    // 标注图层2
    const markSource2 = new XYZ({
        url: urls.value.markSource2URL,
        crossOrigin: 'anonymous'
    });
    markLayer2.value = new TileLayer({
        title: '标注图层2',
        source: markSource2
    });

    // ArcGIS地图服务图层
    arcgisLayer.value = new TileLayer({
        source: new TileArcGISRest({
            url: urls.value.arcgisLayerURL,
            crossOrigin: 'anonymous',
            params: {
                LAYERS: 'show:3' // 参数指定只显示图层ID为3的图层
            }
        })
    });

    if (!mapLeft.value) {
        // 初始化左侧地图实例
        mapLeft.value = new Map({
            target: 'base-map-left',
            layers: [rasterLayer.value, markLayer2.value, arcgisLayer.value],
            view: new View({ // 视图
                projection: 'EPSG:4326', // 坐标系
                center: [119.539408, 29.061271], // 初始化地图中心
                zoom: 11, // 缩放
                maxZoom: 18, // 最大缩放
                minZoom: 1, // 最小缩放
            }),
            controls: defaultControls({
                zoom: false,
                rotate: false
            })
        });

        // 绘图图层
        mapLeft.value.addLayer(drawingLayer);
    }

    if (!mapRight.value) {
        // 初始化右侧地图实例
        mapRight.value = new Map({
            target: 'base-map-right',
            layers: [vectorLayer.value, markLayer1.value, arcgisLayer.value],
            view: new View({ // 视图
                projection: 'EPSG:4326', // 坐标系
                center: [119.539408, 29.061271], // 初始化地图中心
                zoom: 11, // 缩放
                maxZoom: 18, // 最大缩放
                minZoom: 1, // 最小缩放
            }),
            controls: defaultControls({
                zoom: false,
                rotate: false
            })
        });

        // 绘图图层
        mapRight.value.addLayer(drawingLayer);
    }


    // 初始化同步标志
    mapLeft.value.isSyncing = false;
    mapRight.value.isSyncing = false;

    // 添加事件监听器
    mapLeft.value.on('moveend', () => syncMapViews(mapLeft.value, mapRight.value));
    mapRight.value.on('moveend', () => syncMapViews(mapRight.value, mapLeft.value));

    // 更新地图尺寸以确保正确渲染
    mapLeft.value.updateSize();
    mapRight.value.updateSize();
};

const toggleMapsVisibility = () => {
    isMapsVisible.value = !isMapsVisible.value;
    if (isMapsVisible.value) {
        // 当地图容器变为可见时，初始化或更新地图
        nextTick(() => {
            initMaps();
            mapLeft.value.updateSize();
            mapRight.value.updateSize();
        });
    }
};



onMounted(async () => {
    const response = await axios.get('/public/data.json');
    urls.value = response.data;
});


// 绘图功能
const isDrawing = ref(false); // 控制绘图状态
const drawInteractionLeft = ref(null); // 左地图绘图交互
const drawInteractionRight = ref(null); // 右地图绘图交互

// 创建一个用于绘图的 VectorSource
const drawingSource = new VectorSource();

// 创建一个 VectorLayer 用于展示绘图结果，并将 drawingSource 作为其数据源
const drawingLayer = new VectorLayer({
    source: drawingSource,
});

const startDrawing = () => {
    isDrawing.value = true;

    // 创建新的绘图交互并添加到地图中
    const drawType = 'Polygon';

    drawInteractionLeft.value = new Draw({
        source: drawingSource,
        type: drawType,
    });

    drawInteractionRight.value = new Draw({
        source: drawingSource,
        type: drawType,
    });

    mapLeft.value.addInteraction(drawInteractionLeft.value);
    mapRight.value.addInteraction(drawInteractionRight.value);
};

const stopDrawing = () => {
    isDrawing.value = false;

    // 移除绘图交互
    if (drawInteractionLeft.value) {
        mapLeft.value.removeInteraction(drawInteractionLeft.value);
        drawInteractionLeft.value = null;
    }

    if (drawInteractionRight.value) {
        mapRight.value.removeInteraction(drawInteractionRight.value);
        drawInteractionRight.value = null;
    }

    // 清空绘图图层
    drawingSource.clear();
};


// 旋转地图
// 相对旋转地图
const rotateMapRelative = (deltaRotation, map) => {
    const view = map.getView();
    const currentRotation = view.getRotation();
    view.setRotation(currentRotation + deltaRotation);
};

// 同步旋转两个地图
const rotateMapsSync = (deltaRotation) => {
    rotateMapRelative(deltaRotation, mapLeft.value);
    rotateMapRelative(deltaRotation, mapRight.value);
};
</script>


<style scoped>
.base-map-container {
    display: flex;
    /* 使用flex布局使地图并排显示 */
    width: 100%;
    height: 100vh;
    background-color: #fff;
    position: absolute;
    top: 0px;
    right: 0px;
    z-index: 500;
}

.base-map {
    flex-grow: 1;
    /* 使地图容器平分空间 */
    height: 100%;
}

.position {
    position: absolute;
    top: 330px;
    right: 10px;
    padding: 5px;
    font-size: 14px;
    z-index: 600;
}
.draw {
    position: absolute;
    top: 195px;
    right: 10px;
    padding: 5px;
    font-size: 14px;
}

.position div,
.button-draw {
    display: grid;
    place-items: center;
    width: 35px;
    height: 35px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 15px;
    border-radius: 3px;
    margin-top: 10px;
}

.position div:hover,
.button-draw:hover {
    background: rgb(39, 105, 236, 0.7);
}
</style>