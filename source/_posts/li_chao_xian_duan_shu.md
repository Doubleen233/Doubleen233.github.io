---
title: 李超线段树学习笔记
date: 2019-05-10 21:10:00
tags:
 - 线段树
categories: 
 - OI
author: Doubleen
avatar: https://cdn.luogu.com.cn/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: LiChaoTree
photos: http://api.mtyqx.cn/api/random.php
---

# 李超线段树学习笔记

参考/学习/引用：http://www.cnblogs.com/mangoyang/p/9979465.html

## 适用范围

* 一般来说set，cdq能完成的题目，李超线段树都可以完成。

* 一般题型都为在一个平面上维护几条线段，然后求最值（维护斜率）

* 即李超线段树是解决最优势线段问题，支持插入一条线段，查询单点最优势点。线段树上的每一个端点存的都是这个区间内的最优势线段。

## 基本思路

考虑当前有一个线段树上的区间，要在这个区间里插入一条线段并维护答案，不妨分以下几类讨论：

1.如果当前这个区间还没有线段或者新加入的线段完全覆盖原来的线段，那么新加入的线段一定替换原来的线段

2.如果当前新加入的线段被原来的线段完全覆盖，那么这条新加入的线段一定不会再有用了。

3.将新加入的线段和原来的线段求交，将交所在的那半边较劣的线段下放到对应的儿子，更新区间中点的最高的线段。

此时维护的相当于是标记永久化的若干个线段，求答案就是将 $k$ 对应路径上的标记取最优线段，复杂度瓶颈所在的第三种情况每次都只会走一个儿子下放，所以从插入一条线段的复杂度是 $O(logn)$ ，由于要区间修改要在 $logn$ 个节点上插入线段，所以总复杂度 $O(nlog^{2}n)$

## 具体实现方法

设我们插入的线段/直线所在直线的直线解析式为$y=kx+b$

以线段树的每一个区间表示$x$的值的区间，然后每一个区间维护的都是$y$的最值

插入方法就和普通线段树一样，找出一些区间能覆盖这一线段/直线，然后比较最值大小。

比较最值的方法就是对于一段区间分类讨论：

1.如果当前这个区间还没有线段或者新加入的线段完全覆盖原来的线段，那么新加入的线段一定替换原来的线段，区间比较方法就是比较区间的$l$和$r$带进去的值

2.如果当前新加入的线段被原来的线段完全覆盖，那么这条新加入的线段一定不会再有用了。

3.将新加入的线段和原来的线段求交，以区间的$mid$为分割线，自然有一半部分是两条直线不相交的，所以就不用处理，而另一部分就放到儿子的地方，做预备军

4.查询就是将儿子和当前直线取个最值

## 例题

### [HEOI2013]Segment

#### 题目描述

要求在平面直角坐标系下维护两个操作：

1. 在平面上加入一条线段。记第 i 条被插入的线段的标号为 i
2. 给定一个数 k,询问与直线 x = k 相交的线段中，交点最靠上的线段的编号。

模板，就是用刚才的方法解决，如果看不懂上面的方法的话就用这道题理解，~~我也是这样过来的~~，浮点数的精度也是很重要的

```cpp
#include<cstdio>
#include<iostream>
using namespace std;
const int M=2e5+5;
const int mod1=39989,mod2=1e9;
const double eps=1e-6;
int lastans=0,tot=0;
struct node{double k,b; int id;};
inline double dbmax(double a,double b){return a>b?a:b;}
inline double dbabs(double a){return a>0?a:-a;}
struct SegmentTree{
    node s[M<<2]; bool b[M];
    void pushdown(int u,int l,int r,node now)
    {
        if(!b[u]){s[u]=now,b[u]=true;}
        double l1=l*now.k+now.b,l2=l*s[u].k+s[u].b;
        double r1=r*now.k+now.b,r2=r*s[u].k+s[u].b;
        if(l1<=l2&&r1<=r2) return ;
        if(l1>=l2&&r1>=r2) return (void)(s[u]=now);
        double pos=(now.b-s[u].b)/(s[u].k-now.k);//求交点

        int mid=(l+r)>>1;
        if(pos<=mid) pushdown(u<<1,l,mid,r1>r2?s[u]:now);
        else pushdown(u<<1|1,mid+1,r,l1>l2?s[u]:now);
        if((l1>l2&&pos>=mid)||(r1>r2&&pos<mid)) s[u]=now;
    }
    void insert(int u,int l,int r,int x,int y,node now)
    {
        if(l>=x&&r<=y){
            pushdown(u,l,r,now);
            return ;
        }
        int mid=(l+r)>>1;
        if(x<=mid) insert(u<<1,l,mid,x,y,now);
        if(y>mid) insert(u<<1|1,mid+1,r,x,y,now);
    }
    node query(int u,int l,int r,int pos)
    {
        if(l==r) return b[u]?s[u]:(node){0.0,0.0,0};
        int mid=(l+r)>>1; node now;
        if(pos<=mid) now=query(u<<1,l,mid,pos);
        else now=query(u<<1|1,mid+1,r,pos);
        if(!b[u]) return now; 
        double tmp1=pos*now.k+now.b,tmp2=pos*s[u].k+s[u].b;
        if(!now.id||(tmp1<tmp2||(dbabs(tmp1-tmp2)<eps&&s[u].id<now.id))) now=s[u];
        return now;
    }
};
SegmentTree t;
inline int read()
{
    int x=0,f=1; char ch=0;
    while(!isdigit(ch)) f=(ch=='-'?-1:1),ch=getchar();
    while(isdigit(ch)) x=(x<<1)+(x<<3)+(ch^48),ch=getchar();
    return x*f;
}
inline void initx(int &x){x=(x+lastans-1)%mod1+1;}
inline void inity(int &y){y=(y+lastans-1)%mod2+1;}
int main()
{
    int n=read();
    for(register int i=1;i<=n;i++)
    {
        int op=read();
        if(op==0){
            int x=read();
            initx(x);
            printf("%d\n",lastans=t.query(1,1,mod1,x).id);
        }
        else{
            int x0=read(),y0=read(),x1=read(),y1=read();
            initx(x0); inity(y0); initx(x1); inity(y1);
            if(x0>x1) swap(x0,x1),swap(y0,y1);
            if(x0==x1){
                t.insert(1,1,mod1,x0,x1,(node){0.0,dbmax(y0,y1),++tot});
                continue;
            }
            double k=(double)(y1-y0)/(double)(x1-x0),b=(double)y1-x1*k;
            t.insert(1,1,mod1,x0,x1,(node){k,b,++tot});
        }
    }
    return 0;
}
```

## 推荐习题

[JSOI2008]Blue Mary开公司

[SDOI2016]游戏~~~~
