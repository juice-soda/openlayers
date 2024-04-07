<template>
    <!-- 承载地图的容器，注意宽高一定要有，否则不显示 （后面将该文件封装为组件，以便调用） -->
    <div class="base-map-container">
        <!-- 地图容器 -->
        <div class="base-map" id="base-map"></div>
        <!-- 绘图按钮 -->
        <div class="map-buttons" @click="toggleDrawVisibility">
            <UnorderedListOutlined />
        </div>
        <div class="map-draw" v-show="isDrawVisible">
            <div v-for="button in buttons" :key="button.text" @click="button.action" class="map-draw-button">
                <button style="margin: 5px; font-size: 13px"> {{ button.text }}</button>
            </div>
        </div>
        <!-- 图层切换 -->
        <div class="img-buttons">
            <div v-for="button in buttons1" :key="button.text" @click="button.action" class="img-button"
                :class="{ 'active-button': activeLayer === button.id }">
                <img :src="button.imgSrc" :alt="button.text" class="button-image" style="width: 30px; height: 20px;" />
                <div :class="{ 'active-text': activeLayer === button.id }">{{ button.text }}</div>
            </div>
        </div>
        <!-- 下拉框 -->
        <div class="map-controls">
            <a-select v-model="selectedLabel" @change="onLabelSelectChange" style="width: 180px;" placeholder="片区信息">
                <!-- 下拉框，用于实现query查询 -->
                <a-select-option value="" selected>取消选择</a-select-option>
                <a-select-option v-for="label in labels" :key="label" :value="label">{{ label }}</a-select-option>
            </a-select>
            <div id="detailsDiv" class="details-info" v-html="details" v-if="showDetails"></div>
        </div>
        <!-- 添加一个专门的容器来显示比例尺和坐标 -->
        <div id="scale-position" class="scale-position">{{ scaleText }}</div>
        <div id="mouse-position" class="mouse-position" ref="mousePositionRef"></div>
        <MapControls :mapInstance="map" />
        <!-- 图例 -->
        <div class="legend-container">
            <a-switch v-model:checked="showLegends" checked-children="图例" un-checked-children="图例"
                style="margin-bottom: 10px; margin-left: 215px;" />
            <div v-if="showLegends" class="legends">
                <div v-for="(item, index) in legendItems" :key="index" class="legend-item">
                    <span>{{ item.label }}: </span>
                    <div class="color-block" :style="getStyle(item)"></div>
                </div>
            </div>
        </div>
        <!-- 分屏 -->
        <SplitScreen />
        <!-- 叠加信息展示 -->
        <div class="position">
            <div @click="isIdentifyClick">
                <a-tooltip placement="left">
                    <template #title>叠加查询</template>
                    <RadarChartOutlined />
                </a-tooltip>
            </div>
        </div>
        <div class="overlayInfo" v-show="isIdentify">
            <div style="height: 30px;">
                <span>项目信息：</span>
                <a-button @click="isIdentifyClick" size="small" style="margin-left: 120px;">取消</a-button>
            </div>
            <div class="overlayInfos">
                <template v-if="overlayInfoItems.length > 0">
                    <div v-for="(item, index) in overlayInfoItems" :key="index" class="overlayInfo-item"
                        :class="{ 'selected': index === selectedOverlayIndex }" @click="selectOverlayItem(index)"
                        @mouseover="highlightFeature(item.objectid)" @mouseleave="resetHighlight(item.objectid)">
                        <div>项目id: {{ item.objectid }}</div>
                        <div>{{ item.xmmc }}</div>
                        <div>{{ item.pzrq }}</div>
                    </div>
                </template>
                <a-empty v-else />
            </div>
        </div>
    </div>
</template>

<script setup>
import 'ant-design-vue/dist/reset.css'
import { UnorderedListOutlined, RadarChartOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { onMounted, ref } from 'vue';
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import { defaults as defaultControls, MousePosition } from 'ol/control';
import { TileArcGISRest } from 'ol/source';
// 默认导入
import Draw from 'ol/interaction/Draw';
// 命名导入
import { createBox } from 'ol/interaction/Draw';
import { getCenter } from 'ol/extent';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import axios from 'axios';
import MapControls from './components/MapControls.vue';
import SplitScreen from './components/SplitScreen.vue';

// 地图实例对象
const map = ref(null);

// 图层对象
const vectorLayer = ref(null);
const rasterLayer = ref(null);
const markLayer1 = ref(null);
const markLayer2 = ref(null);

// arcgis地图服务图层
const arcgisLayer = ref(null);

// 绘图图层
const drawingLayer = ref(null);
const drawInteraction = ref(null);

// 高亮
const highlightLayer = ref(null);

const scaleText = ref('比例尺1 :');

// 地址数据
const urls = ref({});

// 鼠标位置
const mousePositionRef = ref(null);

// 初始化
const initMap = () => {
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

    // 创建地图对象
    map.value = new Map({
        target: 'base-map', // 地图容器对应id
        layers: [rasterLayer.value, markLayer2.value, vectorLayer.value, markLayer1.value, arcgisLayer.value],
        view: new View({ // 视图
            projection: 'EPSG:4326', // 坐标系
            center: [119.539408, 29.061271], // 初始化地图中心
            zoom: 11, // 缩放
            maxZoom: 30, // 最大缩放
            minZoom: 1, // 最小缩放
        }),
        controls: defaultControls({
            zoom: false,
            rotate: false
        }).extend([
            new MousePosition({
                coordinateFormat: coordinate => {
                    const x = coordinate[0].toFixed(2);
                    const y = coordinate[1].toFixed(2);
                    return `x : ${x}, y : ${y}`;
                },
                projection: 'EPSG:4326',
                target: mousePositionRef.value
            })
        ]),
    });

    // 确保地图渲染后更新比例尺
    map.value.once('postrender', () => {
        updateScale();
    });
    // 监听地图分辨率变化
    map.value.getView().on('change:resolution', updateScale);

    // 创建一个矢量数据源对象，存储用户绘制的图形
    const drawingSource = new VectorSource();
    drawingLayer.value = new VectorLayer({
        source: drawingSource,
    });
    map.value.addLayer(drawingLayer.value);

    // 添加地图点击事件监听器
    map.value.on('click', onMapClick);


    // 叠加图高亮图层
    map.value.addLayer(highlightLayer.value);

    // 在地图初始化或设置地图视图后保存初始状态
    initialMapView.value = map.value.getView().getCenter();
};

// 叠加查询高亮图层
const highlightSource = new VectorSource();
highlightLayer.value = new VectorLayer({
    source: highlightSource,
    style: new Style({
        stroke: new Stroke({
            color: '#ffcc33',
            width: 4,
        }),
        fill: new Fill({
            color: 'rgba(255,204,51,0.4)', // 透明黄色填充
        }),
    }),
});
// 叠加查询原始地图状态
const initialMapView = ref(null);

onMounted(async () => {
    const response1 = await axios.get('/public/data.json');
    urls.value = response1.data;
    // 窗口拖拉，更新地图大小
    window.addEventListener('resize', () => {
        if (map.value) {
            map.value.updateSize()
        }
    });

    initMap()
    // 展示图例
    showLegend()
    // 获取所有唯一的label值并填充下拉框
    fetchLabels()
})

// 绘图按钮
const isDrawVisible = ref(false);

const toggleDrawVisibility = () => {
    isDrawVisible.value = !isDrawVisible.value; // 切换可见性
}

// 设置指定图层为可见，其它图层为不可见
const setLayersVisibility = (visibleLayers) => {
    // 先定义所有可能的图层
    const allLayers = {
        'vectorLayer': vectorLayer.value,
        'rasterLayer': rasterLayer.value,
        'markLayer1': markLayer1.value,
        'markLayer2': markLayer2.value,
        'arcgisLayer': arcgisLayer.value,
    };

    // 遍历所有图层，根据是否在visibleLayers中来设置可见性
    Object.entries(allLayers).forEach(([key, layer]) => {
        if (layer) {
            layer.setVisible(visibleLayers.includes(key));
        }
    });
}

const activeLayer = ref('1');

// 切换到矢量图层
const showVectorLayer = () => {
    setLayersVisibility(['vectorLayer', 'markLayer1', 'arcgisLayer']);
    activeLayer.value = '1';
}

// 切换到影像图层
const showRasterLayer = () => {
    setLayersVisibility(['rasterLayer', 'markLayer2', 'arcgisLayer']);
    activeLayer.value = '2';
}

// 比例尺精度
const updateScale = () => {
    // 获取视图对象，包含了地图的显示范围，缩放级别等
    const view = map.value.getView();
    // 得到当前视图分辨率
    const resolution = view.getResolution();
    const dpi = 25.4 / 0.28; // 假设的屏幕DPI
    // 获取每单位长度对应的米数
    const mpu = view.getProjection().getMetersPerUnit();
    const scale = resolution * mpu * 39.37 * dpi; // 计算比例尺
    scaleText.value = `比例尺1 : ${Math.round(scale)}`;
}

const showLegends = ref(false); // 控制图例显示的状态
const legendItems = ref([]);
// arcgis地图服务层
const showLegend = () => {
    const legendUrl = urls.value.legendURL;
    //  fetch() 函数发送 HTTP 请求来获取图例信息
    fetch(legendUrl)
        // 当请求成功时，使用 response.json() 方法将响应转换为 JSON 格式
        .then(response => response.json())
        .then(data => {
            if (data.drawingInfo && data.drawingInfo.renderer && data.drawingInfo.renderer.uniqueValueInfos) {
                legendItems.value = data.drawingInfo.renderer.uniqueValueInfos.map(legendItem => ({
                    label: legendItem.label,
                    fillColor: `rgba(${legendItem.symbol.color.join(',')})`,
                    borderColor: `rgba(${legendItem.symbol.outline.color.join(',')})`
                }));
            }
        }).catch(error => console.error('Error fetching legend:', error));
}

// 添加一个方法来生成颜色样式
const getStyle = (item) => {
    return {
        backgroundColor: item.fillColor,
        borderColor: item.borderColor,
        width: '20px',
        height: '20px',
        display: 'inline-block',
        marginLeft: '8px',
        border: '1px solid'
    };
}

let isBoxMode = false;
let isDrawing = false;
// 添加绘图
const addDrawingInteraction = (type) => {
    isDrawing = true;
    // 如果绘制交互已经存在，就移除
    if (drawInteraction.value) { map.value.removeInteraction(drawInteraction.value); }

    let geometryFunction;
    if (type === 'Box') {
        type = 'Circle';
        geometryFunction = createBox();
        isBoxMode = true; // 设置为框选模式
    } else {
        isBoxMode = false; // 非框选模式
    }

    drawInteraction.value = new Draw({
        source: drawingLayer.value.getSource(),
        type: type,
        geometryFunction: geometryFunction,
    });

    drawInteraction.value.on('drawend', async (event) => {

        if (isBoxMode) {
            const feature = event.feature;
            // 对于矩形，我们需要获取其边界作为查询参数
            const geometry = feature.getGeometry();
            const extent = geometry.getExtent();
            const extentObj = {
                xmin: extent[0],
                ymin: extent[1],
                xmax: extent[2],
                ymax: extent[3]
            }; // [minx, miny, maxx, maxy]

            // 执行空间查询
            await identifyFeatureDraw(extentObj);
        }

    });
    map.value.addInteraction(drawInteraction.value);
}

// 取消绘图
function cancelDrawing() {
    isDrawing = false;
    if (drawInteraction.value) {
        map.value.removeInteraction(drawInteraction.value);
        drawInteraction.value = null; // 重置绘图交互变量
    }

    // 清空绘图图层上的所有要素
    drawingLayer.value.getSource().clear();

    // 清除现有的高亮图层
    if (highlightLayer.value) {
        map.value.removeLayer(highlightLayer.value);
    }

    details.value = '';
    showDetails.value = false;
}

// 定义一个响应式变量来存储标签列表
const labels = ref([]);

const buttons = [
    { text: '绘制点', action: () => addDrawingInteraction('Point') },
    { text: '绘制线', action: () => addDrawingInteraction('LineString') },
    { text: '绘制面', action: () => addDrawingInteraction('Polygon') },
    { text: '框选查询', action: () => addDrawingInteraction('Box') },
    { text: '取消绘制', action: cancelDrawing },
];
const buttons1 = [
    { text: '矢量', action: showVectorLayer, imgSrc: "src/assets/img1.bmp", id: '1' },
    { text: '影像', action: showRasterLayer, imgSrc: "src/assets/img2.bmp", id: '2' },
]

// 获取label值
const fetchLabels = async () => {
    const labelsUrl = urls.value.labelsURL;
    try {
        const response2 = await fetch(labelsUrl);
        const data = await response2.json();
        if (data.features && Array.isArray(data.features)) {
            const fetchedLabels = data.features.map(feature => feature.attributes.pqmc);
            const uniqueLabels = [...new Set(fetchedLabels)]; // 使用 Set 进行客户端去重
            labels.value = uniqueLabels;
        } else {
            message.error('响应数据不正确', error);
        }
    } catch (error) {
        message.error('获取标签错误', error);
    }
}

const details = ref('');
const selectedLabel = ref('');
// 处理下拉框选择变化
const onLabelSelectChange = async (selectedLabel) => {
    if (!selectedLabel) {
        details.value = '';
        removeQueryLayers();
        showDetails.value = false;
        return;
    }
    const queryUrl = `${urls.value.arcgisLayerURL}/3/query?where=pqmc='${encodeURIComponent(selectedLabel)}'&outFields=*&returnGeometry=true&f=geojson`;
    try {
        const response3 = await fetch(queryUrl);
        const queryData = await response3.json();
        removeQueryLayers();
        renderQueryResults(queryData, selectedLabel);
    } catch (error) {
        message.error('加载详细信息时发生错误', error);
    }
}

// 用于清除现有query查询图层的函数
const removeQueryLayers = () => {
    const queryLayers = map.value.getLayers().getArray()
        .filter(layer => layer.get('isQueryLayer') === true);
    queryLayers.forEach(layer => map.value.removeLayer(layer));
}

const showDetails = ref(false);
// 渲染查询结果
const renderQueryResults = (queryData, label) => {
    if (queryData.features && queryData.features.length > 0) {
        const vectorSource = new VectorSource({
            features: new GeoJSON().readFeatures(queryData, {
                dataProjection: 'EPSG:4326',
                featureProjection: map.value.getView().getProjection(),
            }),
        });
        const vectorLayer = new VectorLayer({
            source: vectorSource,
        });
        vectorLayer.set('isQueryLayer', true);
        map.value.addLayer(vectorLayer);

        const attributes = queryData.features[0].properties;
        showDetails.value = true;
        details.value = `<h4>详细信息: ${label}</h4><p>行政区名称: ${attributes.xzqmc}</p><p>面积: ${attributes.mj}</p>`;
    }
}

// 地图点击事件处理函数，完成identify叠加查询
const onMapClick = (event) => {
    if (isDrawing) return;
    // 获取点击位置的坐标（OpenLayers的坐标）
    const clickedCoord = map.value.getCoordinateFromPixel(event.pixel);

    // 调用 Identify 查询要素信息
    identifyFeature(clickedCoord);
}

const currentQueryLayer = ref(null);
const overlayInfoItems = ref([]);

const isIdentify = ref(false);

// 控制叠加查询的开关
const isIdentifyClick = () => {
    isIdentify.value = !isIdentify.value;
    if (!isIdentify.value) {
        removeidentify();
    }
}

// 清除叠加查询样式
const removeidentify = () => {
    // 清除详细信息
    overlayInfoItems.value = [];
    // 取消选中详细信息
    selectedOverlayIndex.value = -1;
    // 检查是否已有查询结果图层存在，如果有，则先移除
    if (currentQueryLayer.value) {
        map.value.removeLayer(currentQueryLayer.value);
        currentQueryLayer.value = null;
    }

    // 清除之前的高亮显示
    highlightSource.clear();

    map.value.getView().animate({
        center: initialMapView.value,
        zoom: 11,
        duration: 1000
    });

}

// 地图点击，进行叠加查询
const identifyFeature = async (coord) => {
    if (!isIdentify.value) {
        return
    }

    const identifyUrl = `${urls.value.arcgisLayerURL}/identify?geometry=${coord[0]},${coord[1]}&geometryType=esriGeometryPoint&tolerance=3&mapExtent=119.31464540900004,28.911930264000034,119.9117139870001,29.254895781000073&imageDisplay=800,600,96&returnGeometry=true&f=json&layers=visible:3&sr=4490`;

    try {
        const response4 = await fetch(identifyUrl);
        const data = await response4.json();

        // 清除当前样式
        removeidentify();

        if (data.results.length > 0) {
            // 叠加查询
            const selectedFeature = data.results[0];
            const geometry = selectedFeature.geometry;
            // console.log(geometry)
            const overlayQueryUrl = `${urls.value.arcgisLayerURL}/15/query`;

            // 构建叠加查询参数
            const requestBody = {
                f: 'json',
                spatialRel: 'esriSpatialRelIntersects',
                geometry: JSON.stringify(geometry), // 直接使用selectedFeature的geometry，已包含正确的spatialReference
                geometryType: 'esriGeometryPolygon',
                inSR: geometry.spatialReference.wkid, // 使用geometry实际的wkid
                outFields: '*',
                returnGeometry: true
            };

            // 执行叠加查询
            fetch(overlayQueryUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(requestBody).toString()
            })
                .then(response => response.json())
                .then(overlayData => {

                    console.log('overlayData.features:', overlayData.features);

                    // 过滤得到 xmmc 不为 null 的项，并只提取 xmmc 和 pzrq
                    const filteredItems = overlayData.features
                        // 首先，过滤掉xmmc为null的项
                        .filter(feature => feature.attributes.xmmc !== null)
                        // 然后，使用reduce方法去除xmmc重复的项
                        .reduce((acc, feature) => {
                            // 检查累积数组中是否已经有该xmmc值
                            if (!acc.some(item => item.xmmc === feature.attributes.xmmc)) {
                                acc.push({ xmmc: feature.attributes.xmmc, pzrq: feature.attributes.pzrq, objectid: feature.attributes.objectid });
                            }
                            return acc;
                        }, []);

                    // 更新响应式属性，以便在模板中展示
                    overlayInfoItems.value = filteredItems;

                    // 处理叠加查询结果
                    if (overlayData.features && overlayData.features.length > 0) {
                        // 转换ArcGIS查询结果为GeoJSON
                        const features = new GeoJSON().readFeatures({
                            type: 'FeatureCollection',
                            features: overlayData.features.map(feature => ({
                                type: 'Feature',
                                properties: feature.attributes,
                                geometry: {
                                    // 转换ArcGIS的rings格式为GeoJSON的Polygon格式
                                    type: 'Polygon',
                                    coordinates: feature.geometry.rings
                                }
                            })),
                        }, {
                            dataProjection: 'EPSG:4490', // 使用查询结果的空间参考
                            featureProjection: map.value.getView().getProjection() // 转换到地图的投影
                        });

                        // 检查是否已有查询结果图层存在，如果有，则先移除
                        if (currentQueryLayer.value) {
                            map.value.removeLayer(currentQueryLayer.value);
                            currentQueryLayer.value = null;
                        }

                        // 创建VectorSource并设置特征
                        const source = new VectorSource({
                            features: features // 设置特征
                        });

                        const vectorLayer = new VectorLayer({
                            source: source,
                            style: function (feature) {
                                // 使用get方法获取objectid属性
                                const objectId = feature.get('objectid');

                                // 根据特征属性动态返回样式
                                // console.log(feature);
                                return new Style({
                                    fill: new Fill({
                                        color: 'rgba(0, 0, 255, 0.1)' // 半透明的蓝色填充
                                    }),
                                    stroke: new Stroke({
                                        color: '#0000ff', // 蓝色边框
                                        width: 2
                                    }),
                                    text: new Text({
                                        font: '20px Calibri,sans-serif',
                                        fill: new Fill({
                                            color: '#000' // 文本颜色
                                        }),
                                        stroke: new Stroke({
                                            color: '#fff', // 文本描边颜色，以增强对比度和可读性
                                            width: 3
                                        }),
                                        // 假设每个特征的objectid属性包含了ID号
                                        text: objectId.toString()
                                    })
                                });
                            }
                        });
                        // 将图层添加到地图上   
                        currentQueryLayer.value = vectorLayer;
                        map.value.addLayer(currentQueryLayer.value);

                    } else {
                        message.error("没有找到与查询几何相交的特征", error);
                    }
                })
        } else {
            // 没有查询结果，隐藏详情信息的div
            showDetails.value = false;
            details.value = '';
        }
    } catch (error) {
        message.error('加载详细信息时发生错误', error);
    }
}

// 叠加查询详细信息，选中后修改样式
const selectedOverlayIndex = ref(-1);
const selectOverlayItem = (index) => {
    if (selectedOverlayIndex.value === index) {
        // 如果点击的是当前选中项，则取消选中
        selectedOverlayIndex.value = -1;
        // 清除之前的高亮显示
        highlightSource.clear();

        map.value.getView().animate({
            center: initialMapView.value,
            zoom: 11,
            duration: 1000
        });
    } else {
        selectedOverlayIndex.value = index;

        // 获取选中的项目
        const selectedItem = overlayInfoItems.value[index];
        const objectId = selectedItem.objectid;

        // 所有查询结果作为特征添加到了图层（例如currentQueryLayer.value）
        const features = currentQueryLayer.value.getSource().getFeatures();
        // 清除之前的高亮显示
        highlightSource.clear();

        // 根据objectid查找特征
        const feature = features.find(feature => feature.get('objectid') === objectId);

        if (feature) {
            // 获取特征的几何对象
            const geometry = feature.getGeometry();

            // 高亮显示选中的特征
            highlightSource.addFeature(feature);

            // 计算几何对象的中心点
            const center = geometry.getExtent ? getCenter(geometry.getExtent()) : geometry.getCoordinates();

            // 更新地图视图中心
            map.value.getView().animate({
                center: center,
                zoom: 20,
                duration: 1000  // 动画时间
            });
        }
        // 更新选中索引，用于样式变化等
        selectedOverlayIndex.value = index;
    }
};

// 叠加查询，鼠标悬停效果
const highlightFeature = (objectId) => {
    const features = currentQueryLayer.value.getSource().getFeatures();
    const targetFeature = features.find(feature => feature.get('objectid') === objectId);
    if (targetFeature) {
        // 设置高亮样式
        targetFeature.setStyle(new Style({
            stroke: new Stroke({
                color: '#ffcc33',
                width: 4,
            }),
            fill: new Fill({
                color: 'rgba(255,204,51,0.4)',
            }),
            text: new Text({
                font: '20px Calibri,sans-serif',
                fill: new Fill({
                    color: '#fff',
                }),
                stroke: new Stroke({
                    color: 'red',
                    width: 3,
                }),
                text: objectId.toString(),
            }),
        }));
    }
};

const resetHighlight = (objectId) => {
    const features = currentQueryLayer.value.getSource().getFeatures();
    const targetFeature = features.find(feature => feature.get('objectid') === objectId);
    if (targetFeature) {
        // 恢复到默认样式或之前的样式
        targetFeature.setStyle(null);
    }
};

// 地图框选查询
const identifyFeatureDraw = async (extent) => {
    const identifyUrl = `${urls.value.arcgisLayerURL}/identify?geometry=${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}&geometryType=esriGeometryEnvelope&tolerance=3&mapExtent=${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}&imageDisplay=800,600,96&returnGeometry=true&f=json&layers=visible:3&sr=4326`;
    try {
        const response5 = await fetch(identifyUrl);
        const data = await response5.json();
        // 这里处理identify查询的结果...
        // console.log(data)
        // 清除现有的高亮图层
        if (highlightLayer.value) {
            map.value.removeLayer(highlightLayer.value);
        }

        // 将ArcGIS REST API的响应转换为GeoJSON
        const vectorSource = new VectorSource({
            features: new GeoJSON().readFeatures({
                type: 'FeatureCollection',
                features: data.results.map(result => ({
                    type: 'Feature',
                    properties: result.attributes,
                    geometry: {
                        type: result.geometryType === 'esriGeometryPolygon' ? 'Polygon' : 'Point',
                        coordinates: result.geometryType === 'esriGeometryPolygon' ? result.geometry.rings : [[result.geometry.x, result.geometry.y]]
                    }
                })),
            }, {
                dataProjection: 'EPSG:4490',
                featureProjection: map.value.getView().getProjection()
            }),
        });

        highlightLayer.value = new VectorLayer({
            source: vectorSource,
            style: new Style({
                fill: new Fill({ color: 'rgba(255, 255, 0, 0.7)' }),
                stroke: new Stroke({ color: '#ffcc33', width: 2 }),
                image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#ffcc33' }) }),
            }),
        });

        map.value.addLayer(highlightLayer.value);

        // 更新详细信息，这里假设你想展示第一个查询结果的详细信息
        let detailsHtml = '';
        if (data.results && data.results.length > 0) {
            showDetails.value = true;
            data.results.forEach((result, index) => {
                const attributes = result.attributes;
                detailsHtml += `<div class="result-item"><h4>详细信息 : ${index + 1}</h4><p>片区名称: ${attributes['片区名称'] || ''}</p><p>行政区名称: ${attributes['行政区名称'] || ''}</p><p>面积: ${attributes['面积'] || ''}</p></div>`;
            });
        } else {
            // 如果没有查询结果，可以相应地更新UI
            showDetails.value = true;
            detailsHtml = '未找到匹配的要素';
        }
        details.value = detailsHtml;

    } catch (error) {
        message.error('查询失败', 2);
    }
}


</script>

<style>
button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
}

.base-map-container {
    position: relative;
    width: 100%;
    height: 100vh;
}

.base-map {
    width: 100%;
    height: 100%;
}

.map-buttons {
    position: absolute;
    display: grid;
    place-items: center;
    color: white;
    font-size: 15px;
    top: 300px;
    right: 15px;
    height: 35px;
    width: 35px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
}

.map-draw {
    position: absolute;
    top: 300px;
    right: 70px;
    height: 130px;
    width: 90px;
    color: white;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.7);
}

.map-draw-button:hover {
    color: rgb(118, 157, 235);
}

.img-buttons {
    display: flex;
    position: absolute;
    top: 50px;
    right: 10px;
    padding: 8px;
    flex-wrap: wrap;
    gap: 5px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    font-size: 10px;
    color: white;
    text-align: center;
    z-index: 5;
}

.img-button {
    border: 2px solid #ddd;
}

.active-button {
    border: 2px solid rgb(39, 105, 236);
}

.active-text {
    background-color: rgb(39, 105, 236);
}

.scale-position {
    position: absolute;
    width: 130px;
    bottom: 50px;
    left: 20px;
    background: rgba(255, 255, 255, 0.8);
    padding: 5px;
    border-radius: 4px;
    font-size: 14px;
}

.mouse-position {
    position: absolute;
    width: 140px;
    bottom: 50px;
    left: 150px;
    background: rgba(255, 255, 255, 0.8);
    padding: 5px;
    border-radius: 4px;
    font-size: 14px;
}

/* 图例 */
.legend-container {
    position: absolute;
    top: 8px;
    right: 10px;
    width: 300px;
    z-index: 1;
}

.legends {
    height: 250px;
    width: 200px;
    overflow: auto;
    padding: 10px;
    margin-right: 30px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
}

.legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
}

.legend-item span {
    margin-right: 5px;
}

.legend-item img {
    height: 25px;
}

/* 下拉框 */
.map-controls {
    position: absolute;
    top: 35px;
    left: 45px;
    z-index: 99;
}

.details-info {
    position: absolute;
    top: 50px;
    height: 170px;
    width: 180px;
    padding: 10px;
    font-size: 13px;
    background: rgba(255, 255, 255, 0.8);
    overflow: auto;
    border-radius: 4px;
}


.position {
    position: absolute;
    top: 380px;
    right: 10px;
    padding: 5px;
    font-size: 14px;
}

.position div {
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

.position div:hover {
    background: rgb(39, 105, 236, 0.7);
}

.overlayInfo {
    display: flex;
    flex-direction: column;
    align-items: left;
    justify-content: flex-start;
    /* 保持子项在垂直方向上从顶部开始排列 */
    position: absolute;
    top: 30px;
    left: 40px;
    width: 300px;
    height: 600px;
    padding: 5px;

    background: rgb(255, 255, 255);
    border-radius: 5px;
    z-index: 100;
}

.overlayInfos {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
}

.overlayInfo-item {
    padding: 5px;
    height: 75px;
    width: 100%;
    border-bottom: 1px solid #eee;
    font-size: 14px;
    text-align: left;
}

.selected {
    position: fixed;
    top: 62px;
    border: 2px solid rgb(39, 105, 236);
    width: 273px;
    background-color: #fff;
    z-index: 100;
}
</style>