---
title: 二分图匹配
date: 2020-08-02 22:08:41

tags:
- 网络流
- 二分图匹配

categories:
- OI
author: Doubleen
avatar: https://cdn.luogu.com.cn/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: Strling number
photos: http://api.mtyqx.cn/api/random.php
mathjax: true
---
## 棋盘覆盖

### 初步学习二分图

二分图的定义：一张无向图的$N$个节点可以分成$A,B$两个非空集合，并且在同一集合内的点之间都没有边相连（要求$A$中的点所引出的边全部指向$B$集合中的点 $B->A$同理）这就是二分图

### 二分图的判定

dfs爆搜染色，如果产生冲突，即一个点颜色与所连的边产生相等，则不是二分图

```cpp
void dfs(int x,int color)
    v[x]<-color
    for 与之相连的边(x,y)
        if v[y] = 0 then
            dfs(y,3-color)
        else if v[y] = color then
            不是二分图 结束
    
int main()
{
      .....
      for i 1...N
          if v[i] = 0 then dfs(i,1)
      是二分图
      .....    
}
```

### 二分图最大匹配

#### 前置知识：

任意两条边都没有公共端点的边的集合被称为图的一组匹配。在二分图中，包含边数最多的一组匹配被称为二分图的最大匹配

若P是图G中一条连通两个未匹配顶点的路径，已匹配和待匹配的边在P上交替出现，则称P为相对于M的一条增广路径

举例来说，有A、B集合，增广路由A中一个点通向B中一个点，再由B中这个点通向A中一个点……交替进行

![](https://bkimg.cdn.bcebos.com/pic/63d0f703918fa0ec172d55c72a9759ee3c6ddb15?x-bce-process=image/watermark,image_d2F0ZXIvYmFpa2U4MA==,g_7,xp_5,yp_5)



#### 性质

1. P的路径长度必定为奇数，第一条边和最后一条边都不属于M。

2. 不断寻找增广路可以得到一个更大的匹配M’，直到找不到更多的增广路。

3. M为G的最大匹配当且仅当不存在M的增广路径。

4. 对于图来说，最大匹配不是唯一的，但是最大匹配的大小是唯一的。

#### 匈牙利算法

匈牙利算法是基于贪心策略的，它的特点是当一个节点成为匹配节点后，至多因为找到增广路而更换匹配对象，但绝不会再变回非匹配点。具体来说就是通过不断寻找原有匹配M的增广路径，找到一条M匹配的增广路径，就意味着一个更大的匹配M' , 其恰好比M 多一条边最后到找不到更多的增广路。 

$$O(NM)$$ $N$为点数，$M$为边数

具体代码实现如下：

```cpp
bool dfs(int x) {
	for (int i = head[x], y; i; i = next[i])
		if (!visit[y = ver[i]]) {//没有匹配过的话
			visit[y] = 1;//标记匹配过了
			if (!match[y] || dfs(match[y])) {//如果找不到更多的增广路
                match[y]=x;
                return true;
            }
		}
	return false;
}

main() 函数内
for (int i = 1; i <= n; i++) {
	memset(visit, 0, sizeof(visit));
    if (dfs(i)) ans++;
}
```

### 如何建模

二分图的模型要有两个要素：

1. 节点能分成独立的两个集合，每个集合内部都有0条边
2. 每个节点只能与1条匹配边相连

### 例题讲解

对于这道题来讲骨牌是不会重叠的，而且骨牌刚好是$1*2$即可以覆盖相邻的两个点，这对应上面“如何建模”的点2。如果我们把骨牌看作无向边，而相邻的两个点就分到两个集合中，因为一个集合中的点全是不相邻的，所以这对应了点1。

这样建图 做一遍二分图匹配就好了 这就是棋盘上的黑白染色 黑白分别在两个集合中，黑向白引出无向边

代码：

```cpp
#include<cstdio>
#include<cstring>
const int N=1e4+10,M=1e5+10;
int ans,tot,n,m,a,b,match[N];
struct node{
    int to,next,dis;    
}edge[M<<2];
int head[M<<1],cnt;
inline void add(int x,int y){
    edge[++cnt]=(node){y,head[x]},head[x]=cnt;
}//链式前向星
bool flag[101][101],vis[N];
bool dfs(int x)//匈牙利算法
{
    for(register int i=head[x],y;i;i=edge[i].next){
        int to=edge[i].to;
        if(!vis[y=to])
        {
            vis[y]=true;
            if(!match[y]||dfs(match[y]))
            {
                match[y]=x,match[x]=y;
                return true;
            }
        }
    } 
    return false;
}
int main()
{
    scanf("%d%d",&n,&m);
    while(m--)
    {
        scanf("%d%d",&a,&b);
        flag[a][b]=true;
    }
    for(register int i=1;i<=n;i++)
        for(register int j=1;j<=n;j++)
        {
            if(flag[i][j]) continue;
            int pos=(i-1)*n+j;
            if(!flag[i][j-1]&&j>=2) add(pos,pos-1);
            if(!flag[i][j+1]&&j<n) add(pos,pos+1);
            if(!flag[i-1][j]&&i>1) add(pos,pos-n);
            if(!flag[i+1][j]&&i<n) add(pos,pos+n);
        }//建图 向上下左右不同颜色的点连边
    for(register int i=1;i<=n*n;i++)
        if(!match[i])
        {
            memset(vis,0,sizeof(vis));
            if(dfs(i)) ans++;
        }//匈牙利
    printf("%d\n",ans);
    return 0;
}
```

### 网络流

网络流求二分图匹配：

```cpp
#include<cstdio>
#include<cstring>
#include<iostream>
#include<queue>
using namespace std;
const int N=101,M=1e5+10;
const int INF=0x3f3f3f3f;
int ans,n,m,a,b;
struct node{
    int to,next,flow;    
}edge[M<<3];
int head[M],cnt=1; 
int cur[M],d[M],co[M],s,t;
bool flag[N][N];
inline void add(int x,int y){
    edge[++cnt]=(node){y,head[x],1},head[x]=cnt;
    edge[++cnt]=(node){x,head[y],0},head[y]=cnt;
}
void bfs()
{
    queue<int> q;
    for(register int i=0;i<=n*n+1;i++) d[i]=n;
    d[t]=0;
    q.push(t);
    while(!q.empty())
    {
        int u=q.front(); q.pop();
        for(register int i=head[u];i;i=edge[i].next)
        {
            int v=edge[i].to;
            if(d[v]==n&&edge[i^1].flow){
                d[v]=d[u]+1; q.push(v);
            }
        }
    }
}
int dfs(int now,int flow)
{
    if(now==t) return flow;
    int use=0;
    for(register int i=cur[now];i;i=edge[i].next)
    {
        int u=edge[i].to;
        cur[now]=i;
        if(edge[i].flow>0&&d[u]+1==d[now])
        {
            int tmp=dfs(u,min(flow-use,edge[i].flow));
            use+=tmp; edge[i].flow-=tmp; edge[i^1].flow+=tmp;
            if(flow==use) return use;
        }
    }
    cur[now]=head[now];
    if(!(--co[d[now]])) d[s]=n*n+1;
    ++co[++d[now]];
    return use;
}
int main()
{
    scanf("%d%d",&n,&m);
    s=0,t=n*n+1;
    while(m--)
    {
        scanf("%d%d",&a,&b);
        flag[a][b]=true;
    }
    for(register int i=1;i<=n;i++)
        for(register int j=1;j<=n;j++)
        {
            if(flag[i][j]||(i+j)%2==0) continue;
            int pos=(i-1)*n+j;
            if(!flag[i][j-1]&&j>=2) add(pos,pos-1);
            if(!flag[i][j+1]&&j<n) add(pos,pos+1);
            if(!flag[i-1][j]&&i>=2) add(pos,pos-n);
            if(!flag[i+1][j]&&i<n) add(pos,pos+n);
        }
    for(register int i=1;i<=n;i++)
        for(register int j=1;j<=n;j++){
            int pos=(i-1)*n+j;
            if((i+j)%2==0) add(pos,t);
            else add(s,pos);
        }
    bfs();
    for(register int i=0;i<=n*n+1;i++) cur[i]=head[i],co[d[i]]++;
    while(d[s]<n*n+1) 
        ans+=dfs(s,INF);
    printf("%d\n",ans);
    return 0;
}
```





