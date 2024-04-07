<template>
    <div>
        <!-- 缩放和全屏控制按钮 -->
        <div id="zoom-position" class="zoom-position">
            <div @click="zoomIn">
                <a-tooltip placement="left">
                    <template #title>放大</template>
                    <ZoomInOutlined />
                </a-tooltip>
            </div>
            <div @click="zoomOut">
                <a-tooltip placement="left">
                    <template #title>缩小</template>
                    <ZoomOutOutlined />
                </a-tooltip>
            </div>
            <div @click="toggleFullScreen">
                <a-tooltip placement="left">
                    <template #title>全屏</template>
                    <ExpandAltOutlined />
                </a-tooltip>
            </div>
            <div @click="handleExportButtonClick">
                <a-tooltip placement="left">
                    <template #title>导出</template>
                    <DeliveredProcedureOutlined />
                </a-tooltip>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ZoomInOutlined, ZoomOutOutlined, ExpandAltOutlined, DeliveredProcedureOutlined} from '@ant-design/icons-vue';
import { defineProps } from 'vue';
import { saveAs } from 'file-saver';
import { toBlob } from 'html-to-image';
import { message } from 'ant-design-vue';

// 使用defineProps声明期望接收的props
const props = defineProps({
    mapInstance: Object
});
// 在接受数据很多的情况下，可以利用toRefs进行解构，维持了数据的响应性

// 在这里定义zoomIn, zoomOut, toggleFullScreen
const zoomIn = () => {
    if (props.mapInstance) {
        const view = props.mapInstance.getView();
        const zoom = view.getZoom();
        view.setZoom(zoom + 1);
    }
}

const zoomOut = () => {
    if (props.mapInstance) {
        const view = props.mapInstance.getView();
        const zoom = view.getZoom();
        view.setZoom(zoom - 1);
    }
}

const toggleFullScreen = () => {
    // 实现全屏切换逻辑
    // 检查是否已经处于全屏状态
    const isFullScreen = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;

    if (!isFullScreen) {
        // 进入全屏
        const requestFullScreen = document.documentElement.requestFullscreen ||
            document.documentElement.webkitRequestFullScreen ||
            document.documentElement.mozRequestFullScreen ||
            document.documentElement.msRequestFullscreen;

        if (requestFullScreen) {
            requestFullScreen.call(document.documentElement);
        }
    } else {
        // 退出全屏
        const exitFullScreen = document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;

        if (exitFullScreen) {
            exitFullScreen.call(document);
        }
    }
}

// 导出图片
const handleExportButtonClick = () => {
    const mapCanvas = document.querySelector('.ol-viewport canvas');
    if (!mapCanvas) {
        message.error('没有地图!');
        return;
    }

    toBlob(mapCanvas)
        .then((blob) => {
            saveAs(blob, 'map.png');
        })
        .catch((error) => {
            message.error('导出失败:', error);
        });
}

</script>

<style scoped>
.zoom-position {
    position: absolute;
    top: 100px;
    right: 10px;
    padding: 5px;
    font-size: 14px;
}

.zoom-position div {
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

.zoom-position div:hover {
    background: rgb(39, 105, 236, 0.7);
}
</style>
