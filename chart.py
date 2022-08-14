import matplotlib.pyplot as plt

x = []
y = []

dataset = open('output.txt', 'r')

for line in dataset:
    line = line.strip()
    X, Y = line.split(';')
    x.append(X)
    y.append(Y)

dataset.close()

plt.bar(x, y)

plt.title('Vazão da rede sem perdas')
plt.xlabel('Nome do eixo X')
plt.ylabel("Nome do eixo Y")



plt.show()

#plt.title('Vazão da rede com perdas')
