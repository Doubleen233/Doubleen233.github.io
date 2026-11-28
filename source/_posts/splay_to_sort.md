---
title: Splay用来快速排序？？
date: 2019-03-09 20:22:41

tags:
 - 平衡树
 - 排序
 - 数据结构

categories: 
 - OI
author: Doubleen
avatar: https://cdn.luogu.com.cn/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: Sort
photos: http://api.mtyqx.cn/api/random.php
---

### Splay用来快速排序？？

#### 题目:https://www.luogu.org/problemnew/show/P1177

我们知道，二叉查找树是一种快速而有序的树。也就是说，我们可以利用它来做排序，那最后应输出的答案是什么呢？不难想，左子树一定小于右子树，那最后排序出来的结果便是它的中序遍历。

初始代码：

```
#include<cstdio>
#include<iostream>
using namespace std;
const int M=200005;
int fa[M],s[M][2],num[M],root,n,sz;
inline int read()
{
    int x=0,f; char ch=0;
    while(!isdigit(ch)) f=(ch=='-'?-1:1),ch=getchar();
    while(isdigit(ch)) x=(x<<1)+(x<<3)+(ch^48),ch=getchar();
    return x*f;
}
inline void print(int x)
{
    if(x<0) x=-x,putchar('-');
    if(x>9) print(x/10);
    putchar(x%10+48);
}
inline void write(int x){print(x);putchar(' ');}
void setson(int son,int f,int w)
{
    if(son) fa[son]=f;
    if(f) s[f][w]=son;
}
void insert(int x)
{
    if(!root){
        root=++sz;
        num[sz]=x;
        return ;
    }
    int u=root,ff=0;
    while(u)
    {
        ff=u;
        u=s[u][x>num[u]];
    }
    sz++; num[sz]=x;
    setson(sz,ff,x>num[ff]);
}
void dfs(int p)
{
    if(!p) return;
    dfs(s[p][0]);
    write(num[p]);
    dfs(s[p][1]);
}
int main()
{
    int n=read();
    for(register int i=1;i<=n;i++){
        insert(read());
    }
    dfs(root);
    return 0;
}
```

但一定会发生这样的事：

啥！不是说二叉查找树是很快的吗？？
仔细想，原来可能有这样一种数据本身即是有序的，这将二分查找树退化成了一个链表！！！！

emmm怎么办呢

这时，splay就登场啦

我们可以用splay将二分查找树变得稍微平衡些（这里不细讲splay，不懂splay的可以先去学splay）

这样就可以AC了

AC代码：

```
#include<cstdio>
#include<iostream>
using namespace std;
const int M=200005;
int fa[M],s[M][2],num[M],root,n,sz;
inline int read()
{
    int x=0,f; char ch=0;
    while(!isdigit(ch)) f=(ch=='-'?-1:1),ch=getchar();
    while(isdigit(ch)) x=(x<<1)+(x<<3)+(ch^48),ch=getchar();
    return x*f;
}
inline void print(int x)
{
    if(x<0) x=-x,putchar('-');
    if(x>9) print(x/10);
    putchar(x%10+48);
}
inline void write(int x){print(x);putchar(' ');}
inline int ws(int x)
{
    return s[fa[x]][1]==x;
}
void setson(int son,int f,int w)
{
    if(son) fa[son]=f;
    if(f) s[f][w]=son;
}
void rot(int x)
{
    int f=fa[x]; int ff=fa[f];
    int w=ws(x); int wf=ws(f);
    int p=s[x][!w];
    setson(p,f,w);
    setson(x,ff,wf);
    setson(f,x,!w);
}
void splay(int x)
{
//  splay:将x节点旋转为根
/*  1.Zig Step
    2.Zig_Zig Step 
    3.Zig_Zag Step
*/
    for(;fa[x];rot(x)){
        if(fa[fa[x]]&&ws(fa[x])==ws(x)) 
            rot(fa[x]);
    }
    root=x;
}
void insert(int x)
{
    if(!root){
        root=++sz;
        num[sz]=x;
        return ;
    }
    int u=root,ff=0;
    while(u)
    {
        ff=u;
        u=s[u][x>num[u]];
    }
    sz++; num[sz]=x;
    setson(sz,ff,x>num[ff]);
    splay(sz);
}
void dfs(int p)
{
    if(!p) return;
    dfs(s[p][0]);
    write(num[p]);
    dfs(s[p][1]);
}
int main()
{
    int n=read();
    for(register int i=1;i<=n;i++){
        insert(read());
    }
    dfs(root);
    return 0;
}
```

PS:这比stl堆快多了！！！
