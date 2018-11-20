FROM ubuntu:18.04
ADD . /botpress
WORKDIR /botpress/modules
RUN for file in `ls -1 *.tgz`; do mkdir ${file%.*} |tar -zxf $file -C ${file%.*}; done
RUN rm -rf *.tgz
WORKDIR /botpress
ADD /src/templates/data/ /botpress/data/
RUN chmod +x bp
EXPOSE 3000
CMD ["./bp"]
