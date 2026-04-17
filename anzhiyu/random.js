var posts=["2025/05/09/Markdown语法及快捷键/","2025/05/07/用Mihomo打造最强代理机/","2025/05/04/PVE使用外置USB挂载LVM/","2025/05/04/pve日常维护/","2025/05/03/Debian11/","2025/05/03/pve/","2025/04/11/HiDNS/","2025/04/11/CloudflareTunnel访问加速/","2025/04/09/Hexo博客美化/","2025/04/09/全家桶/","2025/04/09/什么是域名滥用？免费域名之殇！全靠自觉，且用且珍惜！/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };