import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

/**
 * echarts 按需引入的唯一出口（码字统计页使用）。
 *
 * 全量包 min 后 1MB+（gzip 343KB），而项目只用柱状图和折线图。
 * 新页面要加图型/组件（如饼图 PieChart、区域缩放 DataZoomComponent）：
 * 在这里补 import 并加进 use()，别回到 `import * as echarts from 'echarts'`。
 */
echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

/** 图表实例类型（echarts/core 不再导出 ECharts 命名，用 init 返回值推导） */
export type EChartsInstance = ReturnType<typeof echarts.init>
export type { EChartsOption }
export { echarts }
