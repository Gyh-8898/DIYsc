export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/login/index",
    "pages/profile/index",
    "pages/profile/edit/index",
    "pages/points/index",
    "pages/coupons/index",
    "pages/agreement/index",
    "pages/portfolio/index",
    "pages/portfolio/detail",
    "pages/promotion/index",
    "pages/promotion/poster",
    "pages/complaint/index",
    "pages/help/index",
    "pages/plaza/index",
    "pages/community/index",
    "pages/community/bazi/index",
    "pages/community/liuyao/index",
    "pages/community/result/index",
    "pages/community/archive/index",
    "pages/community/report/index",
    "pages/orders/index",
    "pages/order/confirm",
    "pages/order/result",
    "pages/order/detail",
    "pages/designer/index",
    "pages/cart/index",
    "pages/address/index",
    "pages/notifications/index"
  ],
  window: {
    navigationBarTitleText: "晶奥之境",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundTextStyle: "dark"
  },
  tabBar: {
    color: "#999999",
    selectedColor: "#10b981",
    backgroundColor: "#ffffff",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "assets/tab-home.png",
        selectedIconPath: "assets/tab-home-active.png"
      },
      {
        pagePath: "pages/plaza/index",
        text: "广场",
        iconPath: "assets/tab-plaza.png",
        selectedIconPath: "assets/tab-plaza-active.png"
      },
      {
        pagePath: "pages/community/index",
        text: "社区",
        iconPath: "assets/tab-community.png",
        selectedIconPath: "assets/tab-community-active.png"
      },
      {
        pagePath: "pages/profile/index",
        text: "我的",
        iconPath: "assets/tab-profile.png",
        selectedIconPath: "assets/tab-profile-active.png"
      }
    ]
  },
  sitemapLocation: "sitemap.json"
});
